# Authentication & Authorization Guide

This guide explains how to configure and use the built-in authentication and authorization systems in Kanji Framework.

---

## 1. Setup and Config

Authentication in Kanji is powered by `@kanjijs/auth` and operates via JWT sessions. The configuration is defined in the `AuthModule` using the `forRoot` method inside the application root module:

```typescript
import { Module } from '@kanjijs/core';
import { AuthModule } from '@kanjijs/auth';

@Module({
  imports: [
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET || 'supersecretkey123',
      previousSecrets: process.env.PREVIOUS_JWT_SECRETS?.split(',') || [],
      providers: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID || '',
          clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        },
      },
    }),
  ],
})
export class AppModule {}
```

### Options Reference

* `jwtSecret`: The primary secret key used to sign and verify JWT session tokens.
* `previousSecrets`: (Optional) Array of legacy secrets used to verify older, active tokens during key rotation.
* `providers`: OAuth2 configurations for GitHub, Google, or Microsoft accounts.

---

## 2. JWT Sessions & Secret Rotation

Kanji includes a built-in `SessionProvider` that handles JWT creation, verification, and rotation.

### JWT Rotation Flow
To rotate your signing keys without forcing active users to log out:
1. Move the current `jwtSecret` value into the `previousSecrets` array.
2. Define a new, secure value for `jwtSecret`.
3. When verifying tokens, Kanji will attempt verification with `jwtSecret` first, falling back in cascade to `previousSecrets`.
4. When a user requests a refresh token via `refreshToken()`, the new JWT is signed using the current `jwtSecret`.

```typescript
import { Inject } from '@kanjijs/core';
import { SESSION_PROVIDER, type SessionProvider } from '@kanjijs/auth';

export class MyAuthService {
  constructor(
    @Inject(SESSION_PROVIDER)
    private readonly session: SessionProvider,
  ) {}

  async login(user: User) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: ['user'],
      scopes: ['read:profile'],
    };

    // Signs using primary jwtSecret
    const token = this.session.createToken(payload, 3600); // 1 hour TTL
    return { token };
  }
}
```

---

## 3. OAuth2 & PKCE Flow

For third-party OAuth authentication, Kanji enforces retrocompatible PKCE (Proof Key for Code Exchange) to prevent authorization code interception attacks.

### Generation & Exchange Example

```typescript
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserProfile,
} from '@kanjijs/auth';

// 1. Generate verifier and challenge on initial login step
const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

// Store the verifier in a temporary cookie/session
const authUrl = getAuthorizationUrl(providerConfig, redirectUri, state, challenge);

// 2. Callback exchange
const token = await exchangeCodeForToken(providerConfig, code, redirectUri, verifier);
const profile = await getUserProfile(providerConfig, token);
```

---

## 4. Guards & Authorization Rules

Kanji provides built-in guards to control access to routes and controllers:

### Basic Authentication Guard
To protect an entire controller, annotate it with `@UseGuards(AuthGuard)`:

```typescript
import { Controller, Get } from '@kanjijs/platform-hono';
import { AuthGuard, UseGuards } from '@kanjijs/auth';

@Controller('/dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  @Get('/')
  async index() {
    return { status: 'authenticated' };
  }
}
```

### Class-Level Permissions (CLP)
CLPs restrict endpoint access to specific roles or states:

```typescript
import { clp } from '@kanjijs/auth';

@Controller('/admin')
@UseGuards(
  AuthGuard,
  clp({
    read: { anyRole: ['admin', 'manager'] },
    create: { role: 'admin' },
  }),
)
export class AdminController {}
```

### Access Control Lists (ACL)
ACLs evaluate permissions against specific resources:

```typescript
import { acl } from '@kanjijs/auth';
import { PostPolicy } from './post.policy.js';

@Controller('/posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Get('/:id')
  @UseGuards(
    acl({
      policy: PostPolicy,
      action: 'read',
      resourceResolver: async (c, id) => {
        // Resolve and return target resource
        return fetchPostById(id);
      },
    }),
  )
  async getPost() {
    // Permission is granted if policy passes
  }
}
```
