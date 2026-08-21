import { describe, it, expect } from 'bun:test';
import {
  EmailService,
  buildMimeMessage,
  encodeHeaderValue,
  parseSmtpReply,
} from '../email.service.js';

describe('EmailService', () => {
  it('should configure with env vars fallback', () => {
    const svc = new EmailService({});
    expect(svc).toBeInstanceOf(EmailService);
  });

  it('should throw if SMTP_HOST is not set', async () => {
    const svc = new EmailService({ host: '' });
    await expect(svc.send({ to: 'a@b.com', subject: 'test', text: 'test' })).rejects.toThrow(
      'SMTP_HOST',
    );
  });
});

describe('parseSmtpReply', () => {
  it('returns null while the reply is incomplete', () => {
    expect(parseSmtpReply([])).toBeNull();
    expect(parseSmtpReply(['250-PIPELINING'])).toBeNull();
  });

  it('parses a single-line reply', () => {
    const reply = parseSmtpReply(['250 OK']);
    expect(reply).toEqual({ code: 250, lines: ['250 OK'] });
  });

  it('parses a multiline EHLO reply', () => {
    const reply = parseSmtpReply([
      '250-smtp.test.com',
      '250-STARTTLS',
      '250 AUTH LOGIN PLAIN',
    ]);
    expect(reply?.code).toBe(250);
    expect(reply?.lines).toHaveLength(3);
  });

  it('does not treat intermediate multiline lines as final', () => {
    expect(parseSmtpReply(['250-OK'])).toBeNull();
  });
});

describe('encodeHeaderValue', () => {
  it('keeps ASCII values untouched', () => {
    expect(encodeHeaderValue('Hello world')).toBe('Hello world');
  });

  it('encodes non-ASCII values as RFC 2047 UTF-8 base64', () => {
    const encoded = encodeHeaderValue('Tu enlace ✓');
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(
      Buffer.from(encoded.replace(/=\?UTF-8\?B\?(.*)\?=/, '$1'), 'base64').toString('utf-8'),
    ).toBe('Tu enlace ✓');
  });
});

describe('buildMimeMessage', () => {
  it('builds a plain text message with core headers', () => {
    const message = buildMimeMessage({
      from: 'Kanji <noreply@test.com>',
      to: 'user@test.com',
      subject: 'Hi',
      text: 'Body',
    });
    expect(message).toContain('From: Kanji <noreply@test.com>');
    expect(message).toContain('To: user@test.com');
    expect(message).toContain('Subject: Hi');
    expect(message).toContain('Content-Type: text/plain; charset=utf-8');
    expect(message.endsWith('Body')).toBe(true);
  });

  it('builds multipart/alternative when html is present', () => {
    const message = buildMimeMessage({
      from: 'noreply@test.com',
      to: 'user@test.com',
      subject: 'Hi',
      text: 'plain',
      html: '<p>rich</p>',
    });
    expect(message).toContain('multipart/alternative');
    expect(message).toContain('text/plain; charset=utf-8');
    expect(message).toContain('text/html; charset=utf-8');
    expect(message).toContain('<p>rich</p>');
  });

  it('dot-stuffs body lines starting with a dot', () => {
    const message = buildMimeMessage({
      from: 'noreply@test.com',
      to: 'user@test.com',
      subject: 'Hi',
      text: '.leading dot',
    });
    expect(message).toContain('\r\n..leading dot');
  });
});
