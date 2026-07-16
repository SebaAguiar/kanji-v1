import jwt from 'jsonwebtoken';
import { Injectable, Inject } from '@kanjijs/core';
import { AUTH_CONFIG, type AuthConfig, type KanjiSession } from './types.js';

@Injectable()
export class SessionProvider {
  constructor(
    @Inject(AUTH_CONFIG)
    private readonly config: AuthConfig,
  ) {}

  /**
   * Crea un token JWT a partir de los datos de la sesión.
   */
  public createToken(session: Omit<KanjiSession, 'expiresAt'>, expiresInSeconds: number): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload: KanjiSession = {
      ...session,
      expiresAt,
    };
    return jwt.sign(payload, this.config.jwtSecret, { expiresIn: expiresInSeconds });
  }

  /**
   * Safely verifies a JWT token and returns the structured session.
   * Returns null if the token is invalid or expired.
   */
  public verifyToken(token: string): KanjiSession | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);

      if (typeof decoded === 'object' && decoded !== null) {
        const payload = decoded as Record<string, unknown>;

        // Strict runtime structural validation without using any/unknown
        if (
          typeof payload.userId === 'string' &&
          typeof payload.email === 'string' &&
          typeof payload.name === 'string' &&
          Array.isArray(payload.roles) &&
          Array.isArray(payload.scopes) &&
          typeof payload.expiresAt === 'number'
        ) {
          return {
            userId: payload.userId,
            email: payload.email,
            name: payload.name,
            roles: payload.roles.filter((role): role is string => typeof role === 'string'),
            scopes: payload.scopes.filter((scope): scope is string => typeof scope === 'string'),
            expiresAt: payload.expiresAt,
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Verifies a token and regenerates it with a fresh expiry.
   * Returns null if the token is invalid or expired.
   */
  public refreshToken(token: string, expiresInSeconds: number): string | null {
    const session = this.verifyToken(token);
    if (!session) return null;
    return this.createToken(
      {
        userId: session.userId,
        email: session.email,
        name: session.name,
        roles: session.roles,
        scopes: session.scopes,
      },
      expiresInSeconds,
    );
  }
}
