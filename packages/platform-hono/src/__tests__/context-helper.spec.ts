import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import {
  getValidatedBody,
  getValidatedQuery,
  getValidatedParams,
  getValidatedHeaders,
  getRequestId,
  getAuthUser,
  getAuthRoles,
  getAuthScopes,
} from '../context-helper.js';
import { KANJI_CTX } from '../types.js';

describe('context-helper', () => {
  it('getValidatedBody should return the validated body from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.VALIDATED_BODY, { name: 'test' });
      const body = getValidatedBody(c);
      return c.json(body);
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.name).toBe('test');
  });

  it('getValidatedQuery should return the validated query from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.VALIDATED_QUERY, { page: '1' });
      const query = getValidatedQuery(c);
      return c.json(query);
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.page).toBe('1');
  });

  it('getValidatedParams should return the validated params from context', async () => {
    const app = new Hono();
    app.get('/test/:id', (c) => {
      c.set(KANJI_CTX.VALIDATED_PARAMS, { id: '42' });
      const params = getValidatedParams(c);
      return c.json(params);
    });

    const res = await app.request('/test/42');
    const body = await res.json();
    expect(body.id).toBe('42');
  });

  it('getValidatedHeaders should return validated headers from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.VALIDATED_HEADERS, { authorization: 'Bearer token' });
      const headers = getValidatedHeaders(c);
      return c.json(headers);
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.authorization).toBe('Bearer token');
  });

  it('getRequestId should return requestId from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.REQUEST_ID, 'req-123');
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.id).toBe('req-123');
  });

  it('getAuthUser should return user from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: 'a@b.com', name: 'Alice', roles: [] });
      const user = getAuthUser(c);
      return c.json(user);
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.id).toBe('user-1');
    expect(body.email).toBe('a@b.com');
  });

  it('getAuthRoles should return roles from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.AUTH_ROLES, ['admin', 'user']);
      const roles = getAuthRoles(c);
      return c.json({ roles });
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.roles).toEqual(['admin', 'user']);
  });

  it('getAuthRoles should return empty array when not set', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      const roles = getAuthRoles(c);
      return c.json({ roles });
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.roles).toEqual([]);
  });

  it('getAuthScopes should return scopes from context', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      c.set(KANJI_CTX.AUTH_SCOPES, ['read', 'write']);
      const scopes = getAuthScopes(c);
      return c.json({ scopes });
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.scopes).toEqual(['read', 'write']);
  });
});
