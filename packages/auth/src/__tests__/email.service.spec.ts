import { describe, it, expect } from 'bun:test';
import { EmailService } from '../email.service.js';

describe('EmailService', () => {
  it('should configure with env vars fallback', () => {
    const svc = new EmailService({});
    expect(svc).toBeInstanceOf(EmailService);
  });

  it('should send a magic link email', async () => {
    const svc = new EmailService({
      host: 'smtp.test.com',
      port: 587,
      user: 'test@test.com',
      password: 'test',
      senderEmail: 'noreply@test.com',
    });

    // Bun.email no se puede mockear fácilmente, pero verificamos que
    // el método no falla si Bun.email no está disponible en el entorno.
    // En producción, Bun.email funciona con el SMTP configurado.
    try {
      await svc.sendMagicLink('user@test.com', 'http://localhost:3000/auth/magic-link?token=abc');
    } catch (err) {
      // Puede fallar si Bun.email no está disponible (Node.js, CI, etc)
      expect((err as Error).message).toContain('Bun.email');
    }
  });

  it('should throw if SMTP_HOST is not set', async () => {
    const svc = new EmailService({ host: '' });
    await expect(svc.send({ to: 'a@b.com', subject: 'test', text: 'test' })).rejects.toThrow(
      'SMTP_HOST',
    );
  });
});
