import { z } from 'zod';
import type { KanjiLogger } from '@kanjijs/common';
import { env } from '@kanjijs/common';

export interface EmailServiceConfig {
  /**
   * SMTP host (e.g. 'smtp.gmail.com', 'mail.example.com')
   * Default: process.env.SMTP_HOST
   */
  host?: string;
  /**
   * SMTP port. 587 uses STARTTLS, 465 uses implicit TLS.
   * Default: process.env.SMTP_PORT or 587
   */
  port?: number;
  /**
   * SMTP username
   * Default: process.env.SMTP_USER
   */
  user?: string;
  /**
   * SMTP password
   * Default: process.env.SMTP_PASS
   */
  password?: string;
  /**
   * Sender name (default: 'Kanji Auth')
   */
  senderName?: string;
  /**
   * Sender email (default: process.env.SMTP_FROM)
   */
  senderEmail?: string;
  /**
   * Logger for delivery events
   */
  logger?: KanjiLogger;
}

interface SmtpReply {
  code: number;
  lines: string[];
}

/**
 * Parses an incremental SMTP reply buffer. An SMTP reply is complete when its
 * final line is `<code><space>...`; intermediate lines use `<code>-...`.
 * Returns null while the reply is still incomplete.
 */
export function parseSmtpReply(
  lines: string[],
): SmtpReply | null {
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1];
  const match = /^(\d{3})[ ]/.exec(last);
  if (!match) return null;
  return { code: Number(match[1]), lines };
}

/**
 * Encodes a Subject header value with RFC 2047 when it contains
 * non-printable-ASCII characters.
 */
export function encodeHeaderValue(value: string): string {
   
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

/**
 * Builds a RFC 5322 message. Uses multipart/alternative when `html` is
 * present. Applies SMTP dot-stuffing so lines starting with '.' are not
 * mistaken for the end-of-data marker.
 */
export function buildMimeMessage(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): string {
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@kanji.dev>`;

  const headers: string[] = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${encodeHeaderValue(options.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];

  let body: string;
  if (options.html) {
    const boundary = `kanji-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      options.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      options.html,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: 8bit');
    body = options.text;
  }

  const message = [...headers, '', body].join('\r\n');
  return message.replace(/(^|\r\n)\./g, '$1..');
}

type ReplyWaiter = {
  resolve: (reply: SmtpReply) => void;
  reject: (error: Error) => void;
};

const COMMAND_TIMEOUT_MS = 30_000;

class SmtpConnection {
  private socket: Bun.Socket<undefined> | null = null;
  private buffer = '';
  private completeLines: string[] = [];
  private lastReplyText = '';
  private waiter: ReplyWaiter | null = null;

  async open(host: string, port: number, useImplicitTls: boolean): Promise<SmtpReply> {
    const greeting = new Promise<SmtpReply>((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
    this.socket = await Bun.connect<undefined>({
      hostname: host,
      port,
      tls: useImplicitTls ? true : undefined,
      socket: {
        data: (_socket, chunk) => this.feed(chunk.toString('utf-8')),
        error: (_socket, error) => this.fail(error instanceof Error ? error : new Error(String(error))),
        close: () => {
          if (this.waiter) {
            this.fail(new Error('SMTP connection closed unexpectedly'));
          }
        },
      },
    });
    return greeting;
  }

  async command(expectedCode: number, payload: string): Promise<SmtpReply> {
    if (!this.socket) throw new Error('SMTP connection is not open');
    const reply = new Promise<SmtpReply>((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
    this.socket.write(`${payload}\r\n`);
    const result = await this.withTimeout(reply);
    if (Math.floor(result.code / 100) !== Math.floor(expectedCode / 100)) {
      throw new Error(
        `SMTP command failed (expected ${expectedCode}, got ${result.code}): ${payload.split('\r\n')[0]} -> ${result.lines.join(' ')}`,
      );
    }
    return result;
  }

  async startTls(hostname: string): Promise<void> {
    if (!this.socket) throw new Error('SMTP connection is not open');
    const current = this.socket;
    const upgraded = current.upgradeTLS<undefined>({
      tls: { serverName: hostname },
      socket: {
        data: (_socket, chunk) => this.feed(chunk.toString('utf-8')),
        error: (_socket, error) => this.fail(error instanceof Error ? error : new Error(String(error))),
        close: () => {
          if (this.waiter) {
            this.fail(new Error('SMTP connection closed during TLS handshake'));
          }
        },
      },
    });
    this.socket = upgraded[1];
  }

  supportsStartTls(): boolean {
    return this.lastReplyText.toUpperCase().includes('STARTTLS');
  }

  supportsAuth(): boolean {
    return this.lastReplyText.toUpperCase().includes('AUTH');
  }

  close(): void {
    try {
      this.socket?.end();
      this.socket?.close();
    } catch {
      // best effort shutdown
    }
    this.socket = null;
  }

  private withTimeout(promise: Promise<SmtpReply>): Promise<SmtpReply> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('SMTP command timed out'));
      }, COMMAND_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private feed(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf('\r\n')) !== -1) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      this.completeLines.push(line);
    }
    const reply = parseSmtpReply(this.completeLines);
    if (reply && this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      this.lastReplyText = reply.lines.join('\n');
      this.completeLines = [];
      waiter.resolve(reply);
    }
  }

  private fail(error: Error): void {
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter.reject(error);
    }
  }
}

/**
 * Sends email over raw SMTP using Bun.connect — no external dependencies.
 *
 * Port 587 negotiates STARTTLS; port 465 connects with implicit TLS.
 * Authentication uses AUTH LOGIN with AUTH PLAIN as fallback.
 */
export class EmailService {
  private readonly host: string;
  private readonly port: number;
  private readonly user?: string;
  private readonly password?: string;
  private readonly senderName: string;
  private readonly senderEmail: string;
  private readonly logger?: KanjiLogger;

  constructor(config: EmailServiceConfig = {}) {
    this.host = config.host ?? env('SMTP_HOST', z.string().optional()) ?? '';
    this.port = config.port ?? Number(env('SMTP_PORT', z.string().optional()) ?? 587);
    this.user = config.user ?? env('SMTP_USER', z.string().optional());
    this.password = config.password ?? env('SMTP_PASS', z.string().optional());
    this.senderName = config.senderName ?? 'Kanji Auth';
    this.senderEmail =
      config.senderEmail ?? env('SMTP_FROM', z.string().optional()) ?? 'noreply@kanji.dev';
    this.logger = config.logger;
  }

  /**
   * Sends an email over SMTP.
   */
  async send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    if (!this.host) {
      throw new Error(
        'EmailService: SMTP_HOST no configurado. ' +
          'Setéalo en .env o pasalo en el constructor.',
      );
    }

    if (this.logger) {
      this.logger.log(`Enviando email a ${options.to}: "${options.subject}"`, 'EmailService');
    }

    const connection = new SmtpConnection();
    try {
      const useImplicitTls = this.port === 465;
      const greeting = await connection.open(this.host, this.port, useImplicitTls);
      if (greeting.code !== 220) {
        throw new Error(`SMTP server rejected connection: ${greeting.lines.join(' ')}`);
      }

      const ehloDomain = this.senderEmail.split('@')[1] ?? 'localhost';
      await connection.command(250, `EHLO ${ehloDomain}`);

      if (!useImplicitTls && this.port !== 25 && connection.supportsStartTls()) {
        await connection.command(220, 'STARTTLS');
        await connection.startTls(ehloDomain);
        await connection.command(250, `EHLO ${ehloDomain}`);
      }

      if (this.user && this.password) {
        await this.authenticate(connection);
      }

      const from = `${this.senderName} <${this.senderEmail}>`;
      await connection.command(250, `MAIL FROM:<${this.senderEmail}>`);
      await connection.command(250, `RCPT TO:<${options.to}>`);
      await connection.command(354, 'DATA');

      const message = buildMimeMessage({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      await connection.command(250, `${message}\r\n.`);

      await connection.command(221, 'QUIT');
    } finally {
      connection.close();
    }

    if (this.logger) {
      this.logger.log(`Email enviado a ${options.to}`, 'EmailService');
    }
  }

  /**
   * Envía un magic link por email.
   */
  async sendMagicLink(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Tu enlace de acceso',
      text: `Ingresá a tu cuenta usando este enlace:\n\n${link}\n\nSi no solicitaste este acceso, ignorá este mensaje.\n\n— Kanji Auth`,
      html: `<p>Ingresá a tu cuenta usando este enlace:</p>
<p><a href="${link}">${link}</a></p>
<hr>
<p style="color: #666;">Si no solicitaste este acceso, ignorá este mensaje.</p>
<p>— Kanji Auth</p>`,
    });
  }

  private async authenticate(connection: SmtpConnection): Promise<void> {
    if (!this.user || !this.password) return;
    try {
      await connection.command(334, 'AUTH LOGIN');
      await connection.command(334, Buffer.from(this.user, 'utf-8').toString('base64'));
      await connection.command(
        235,
        Buffer.from(this.password, 'utf-8').toString('base64'),
      );
    } catch {
      const plain = Buffer.from(`\0${this.user}\0${this.password}`, 'utf-8').toString('base64');
      await connection.command(235, `AUTH PLAIN ${plain}`);
    }
  }
}
