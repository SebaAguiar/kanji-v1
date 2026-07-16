/**
 * Auto-generated Client SDK for Kanji API
 * Generated at: 2026-07-13T15:40:42.741Z
 */

export interface APIClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface PostUsersBody {
  /** The user's primary email address */
  email: string;
  /** The user's full name */
  name: string;
}

export interface PostUsersResponse {
  /** Unique identifier for the user */
  id: string;
  /** Email address */
  email: string;
  /** Full name */
  name: string;
  /** The status of the user account */
  status?: 'active' | 'inactive' | 'pending';
  /** @format date-time */
  /** Timestamp when the user was created */
  createdAt?: string;
}

export interface GetUsersResponse {
  /** Unique identifier for the user */
  id: string;
  /** Email address */
  email: string;
  /** Full name */
  name: string;
  /** The status of the user account */
  status?: 'active' | 'inactive' | 'pending';
  /** @format date-time */
  /** Timestamp when the user was created */
  createdAt?: string;
}
[];

export interface PostProductsBody {
  name: string;
}

export interface PostProductsResponse {
  id: string;
  name: string;
}

export interface GetProductsResponse {
  id: string;
  name: string;
}
[];

export interface GetProductsByIdResponse {
  id: string;
  name: string;
}

export interface PatchProductsByIdBody {
  name?: string;
}

export interface PatchProductsByIdResponse {
  id: string;
  name: string;
}

export interface DeleteProductsByIdResponse {
  success: boolean;
}

export class APIClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: APIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.defaultHeaders = options.headers || {};
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, unknown>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Request failed with status ${response.status}: ${errorText}`);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  async getAuthSigninByProvider(
    provider: string,
    options?: { headers?: Record<string, string> },
  ): Promise<null> {
    return this.request<null>('GET', `/auth/signin/${provider}`, {
      headers: options?.headers,
    });
  }

  async getAuthCallback(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('GET', `/auth/callback`, {
      headers: options?.headers,
    });
  }

  async getAuthMe(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('GET', `/auth/me`, {
      headers: options?.headers,
    });
  }

  async getApiOpenapi(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('GET', `/api/openapi.json`, {
      headers: options?.headers,
    });
  }

  async getApiDocs(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('GET', `/api/docs`, {
      headers: options?.headers,
    });
  }

  async postUsers(
    body: PostUsersBody,
    options?: { headers?: Record<string, string> },
  ): Promise<PostUsersResponse> {
    return this.request<PostUsersResponse>('POST', `/users`, {
      body,
      headers: options?.headers,
    });
  }

  /**
   * @deprecated This endpoint is deprecated and may be removed in future versions.
   */
  async getUsers(options?: { headers?: Record<string, string> }): Promise<GetUsersResponse> {
    return this.request<GetUsersResponse>('GET', `/users`, {
      headers: options?.headers,
    });
  }

  async getUsersMe(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('GET', `/users/me`, {
      headers: options?.headers,
    });
  }

  async postAuthLogin(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('POST', `/auth/login`, {
      headers: options?.headers,
    });
  }

  async postAuthRefresh(options?: { headers?: Record<string, string> }): Promise<null> {
    return this.request<null>('POST', `/auth/refresh`, {
      headers: options?.headers,
    });
  }

  async postProducts(
    body: PostProductsBody,
    options?: { headers?: Record<string, string> },
  ): Promise<PostProductsResponse> {
    return this.request<PostProductsResponse>('POST', `/products`, {
      body,
      headers: options?.headers,
    });
  }

  async getProducts(options?: { headers?: Record<string, string> }): Promise<GetProductsResponse> {
    return this.request<GetProductsResponse>('GET', `/products`, {
      headers: options?.headers,
    });
  }

  async getProductsById(
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<GetProductsByIdResponse> {
    return this.request<GetProductsByIdResponse>('GET', `/products/${id}`, {
      headers: options?.headers,
    });
  }

  async patchProductsById(
    id: string,
    body: PatchProductsByIdBody,
    options?: { headers?: Record<string, string> },
  ): Promise<PatchProductsByIdResponse> {
    return this.request<PatchProductsByIdResponse>('PATCH', `/products/${id}`, {
      body,
      headers: options?.headers,
    });
  }

  async deleteProductsById(
    id: string,
    options?: { headers?: Record<string, string> },
  ): Promise<DeleteProductsByIdResponse> {
    return this.request<DeleteProductsByIdResponse>('DELETE', `/products/${id}`, {
      headers: options?.headers,
    });
  }
}
