import { randomUUID } from 'crypto';
import type { KanjiSession } from './types.js';

// ─── Password Auth ──────────────────────────────────────────

export interface PasswordAuthConfig {
  /** Cost factor for bcrypt (default: 10) */
  bcryptRounds?: number;
}

/**
 * Maneja registro y verificación con email + password.
 *
 * Las contraseñas se hashean con Bun.password (bcrypt por defecto).
 * El usuario provee la función de lookup de usuarios (findByEmail) ya
 * que Kanji no dicta el modelo de datos.
 */
export class PasswordAuth {
  constructor(private readonly config: PasswordAuthConfig = {}) {}

  /**
   * Hashea una contraseña para almacenamiento seguro.
   */
  async hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: this.config.bcryptRounds ?? 10,
    });
  }

  /**
   * Verifica una contraseña contra un hash almacenado.
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
  }

  /**
   * Construye un objeto KanjiSession a partir de un usuario autenticado.
   * Útil después de verificar credenciales exitosamente.
   */
  buildSession(user: {
    id: string;
    email: string;
    name: string;
    roles?: string[];
  }): Omit<KanjiSession, 'expiresAt'> {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles ?? ['user'],
      scopes: [],
    };
  }
}

// ─── Magic Link Auth ────────────────────────────────────────

export interface MagicLinkConfig {
  /** TTL del magic link en segundos (default: 900 = 15 min) */
  ttlSeconds?: number;
  /** Función para enviar el magic link por email. El usuario debe implementarla. */
  sendEmail?: (to: string, link: string) => Promise<void>;
}

interface MagicLinkEntry {
  email: string;
  token: string;
  expiresAt: number;
  used: boolean;
}

/**
 * Maneja autenticación passwordless via magic link.
 *
 * Flujo:
 * 1. Usuario ingresa su email
 * 2. Se genera un token único con TTL
 * 3. Se envía un link con el token al email
 * 4. Usuario hace clic → se verifica el token → se crea sesión
 *
 * El usuario debe implementar `sendEmail` o llamar a `sendMagicLink()`
 * manualmente para integrar con su sistema de emails.
 */
export class MagicLinkAuth {
  private readonly store = new Map<string, MagicLinkEntry>();
  private readonly ttlMs: number;
  private readonly sendEmailFn?: (to: string, link: string) => Promise<void>;

  constructor(config: MagicLinkConfig = {}) {
    this.ttlMs = (config.ttlSeconds ?? 900) * 1000;
    this.sendEmailFn = config.sendEmail;
  }

  /**
   * Genera un magic link para el email dado y lo envía (si hay sendEmail configurado).
   * Retorna el token y el link generado por si el usuario quiere enviarlo manualmente.
   */
  async sendMagicLink(email: string, baseUrl: string): Promise<{ token: string; link: string }> {
    const token = randomUUID();
    const expiresAt = Date.now() + this.ttlMs;

    this.store.set(token, { email, token, expiresAt, used: false });

    const link = `${baseUrl.replace(/\/$/, '')}/auth/magic-link?token=${token}`;

    if (this.sendEmailFn) {
      await this.sendEmailFn(email, link);
    }

    return { token, link };
  }

  /**
   * Verifica un magic link token.
   * Retorna el email asociado si es válido, o null si expiró / ya fue usado / no existe.
   *
   * El token se consume al ser verificado (single-use).
   */
  verifyToken(token: string): { email: string } | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (entry.used) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return null;
    }

    // Consumir el token (single-use)
    entry.used = true;
    this.store.delete(token);

    return { email: entry.email };
  }

  /**
   * Limpia tokens expirados.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.store) {
      if (now > entry.expiresAt || entry.used) {
        this.store.delete(token);
      }
    }
  }
}
