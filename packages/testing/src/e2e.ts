import type { Hono } from 'hono';

export class E2eResponse {
  constructor(private readonly res: Response) {}

  get status(): number {
    return this.res.status;
  }

  get ok(): boolean {
    return this.res.ok;
  }

  get headers(): Headers {
    return this.res.headers;
  }

  async json<T = unknown>(): Promise<T> {
    return this.res.json() as Promise<T>;
  }

  async text(): Promise<string> {
    return this.res.text();
  }
}

export class E2eRequestBuilder {
  private currentHeaders: Record<string, string> = {};

  constructor(private readonly app: Hono) {}

  header(name: string, value: string): this {
    this.currentHeaders[name] = value;
    return this;
  }

  auth(tokenOrSession: string | { userId: string }): this {
    if (typeof tokenOrSession === 'string') {
      this.currentHeaders['Authorization'] = `Bearer ${tokenOrSession}`;
    } else {
      this.currentHeaders['X-Test-User-Id'] = tokenOrSession.userId;
    }
    return this;
  }

  async get(path: string): Promise<E2eResponse> {
    return this.request('GET', path);
  }

  async post(path: string, body?: unknown): Promise<E2eResponse> {
    return this.request('POST', path, body);
  }

  async put(path: string, body?: unknown): Promise<E2eResponse> {
    return this.request('PUT', path, body);
  }

  async patch(path: string, body?: unknown): Promise<E2eResponse> {
    return this.request('PATCH', path, body);
  }

  async delete(path: string): Promise<E2eResponse> {
    return this.request('DELETE', path);
  }

  private async request(method: string, path: string, body?: unknown): Promise<E2eResponse> {
    const init: RequestInit = {
      method,
      headers: { ...this.currentHeaders },
    };

    if (body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await this.app.request(path, init);
    return new E2eResponse(res);
  }
}

export function request(app: Hono): E2eRequestBuilder {
  return new E2eRequestBuilder(app);
}
