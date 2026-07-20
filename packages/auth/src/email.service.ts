import type { KanjiLogger } from '@kanjijs/common';

export interface EmailServiceConfig {
  /**
   * SMTP host (e.g. 'smtp.gmail.com', 'mail.example.com')
   * Default: process.env.SMTP_HOST
   */
  host?: string;
  /**
   * SMTP port (default: 587)
   * Default: process.env.SMTP_PORT
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
   * Logger para registrar envíos
   */
  logger?: KanjiLogger;
}

/**
 * Servicio de email integrado que usa Bun.email con SMTP directo.
 *
 * Kanji actúa como su propio proveedor de email — no necesita
 * Resend, SendGrid, ni ningún servicio externo.
 *
 * Configuración mínima:
 * ```env
 * SMTP_HOST=smtp.gmail.com
 * SMTP_PORT=587
 * SMTP_USER=tu@email.com
 * SMTP_PASS=tu-contraseña
 * SMTP_FROM=tu@email.com
 * ```
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
    this.host = config.host ?? process.env.SMTP_HOST ?? '';
    this.port = config.port ?? Number(process.env.SMTP_PORT) ?? 587;
    this.user = config.user ?? process.env.SMTP_USER;
    this.password = config.password ?? process.env.SMTP_PASS;
    this.senderName = config.senderName ?? 'Kanji Auth';
    this.senderEmail = config.senderEmail ?? process.env.SMTP_FROM ?? 'noreply@kanji.dev';
    this.logger = config.logger;
  }

  /**
   * Envía un email de texto plano por SMTP.
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

    await Bun.email({
      host: this.host,
      port: this.port,
      tls: this.port === 465 ? true : undefined,
      starttls: this.port === 587 ? true : undefined,
      auth: this.user && this.password ? {
        user: this.user,
        pass: this.password,
      } : undefined,
      from: `${this.senderName} <${this.senderEmail}>`,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      ...(options.html ? { html: options.html } : {}),
    });

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
}
