/**
 * Auto-generated type-safe API client
 * Generated from OpenAPI specification
 * 
 * This client provides:
 * - Full type safety for all endpoints
 * - Autocomplete for parameters and responses
 * - Compile-time validation
 * - Type-safe error handling with discriminated unions
 * - Request/response interceptors
 * - Automatic retry logic with exponential backoff
 */

// ============================================================================
// DISCRIMINATED UNION TYPES FOR TYPE-SAFE ERROR HANDLING
// ============================================================================
// These types use a "discriminator" property (_tag) to help TypeScript narrow
// types. When you check result._tag === 'Success', TypeScript knows result.data
// exists. This prevents forgetting to handle errors.

/**
 * Error result type - represents an API error response
 * @template TStatus - The HTTP status code type (defaults to number)
 * 
 * readonly properties ensure immutability, which is important for discriminated
 * unions to work correctly. If _tag could change, TypeScript couldn't safely
 * narrow types.
 */
export type ApiError<TStatus extends number = number> = {
  readonly _tag: 'ApiError';  // Discriminator - must be exactly 'ApiError'
  readonly status: TStatus;     // HTTP status code (e.g., 404, 500)
  readonly message: string;     // Error message
  readonly data?: unknown;      // Optional error data (unknown is safer than any)
};

/**
 * Success result type - represents a successful API response
 * @template TData - The type of data returned by the API
 */
export type ApiSuccess<TData> = {
  readonly _tag: 'Success';  // Discriminator - must be exactly 'Success'
  readonly data: TData;       // The actual response data
};

/**
 * Union type representing either success or error
 * 
 * This is a discriminated union - TypeScript uses the _tag property to narrow
 * the type. You MUST check _tag before accessing properties, which ensures
 * proper error handling.
 * 
 * @template TData - Type of data on success
 * @template TStatus - Type of status code on error (defaults to number)
 * 
 * Usage:
 * const result = await client.getUser();
 * if (result._tag === 'Success') {
 *   console.log(result.data.name);  // TypeScript knows data exists here
 * } else {
 *   console.error(result.status);   // TypeScript knows status exists here
 * }
 */
export type ApiResult<TData, TStatus extends number = number> = 
  | ApiSuccess<TData>
  | ApiError<TStatus>;

// ============================================================================
// INTERCEPTOR TYPE DEFINITIONS
// ============================================================================
// Interceptors allow modifying requests before sending or responses after
// receiving. Common use cases: adding headers, logging, transforming data.

/**
 * Request interceptor - modifies request before sending
 * Can be async (returns Promise) or sync (returns directly)
 * 
 * Example: Add custom header to all requests
 * client.addRequestInterceptor((req) => {
 *   req.headers = { ...req.headers, 'X-Custom': 'value' };
 *   return req;
 * });
 */
export type RequestInterceptor = (request: RequestInit) => RequestInit | Promise<RequestInit>;

/**
 * Response interceptor - modifies response after receiving
 * Generic T allows type-safe access to response data
 * 
 * Example: Log all responses
 * client.addResponseInterceptor((response, data) => {
 *   console.log('Response:', data);
 *   return data;
 * });
 */
export type ResponseInterceptor<T = unknown> = (response: Response, data: T) => T | Promise<T>;

// Type definitions

export class GovtAPIClient {
  private baseUrl: string = "https://data.linz.govt.nz/services/query/v1";
  private apiKey?: string;
  private bearerToken?: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    bearerToken?: string;
    maxRetries?: number;
  }) {
    if (config?.baseUrl) this.baseUrl = config.baseUrl;
    if (config?.apiKey) this.apiKey = config.apiKey;
    if (config?.bearerToken) this.bearerToken = config.bearerToken;
    if (config?.maxRetries !== undefined) this.maxRetries = config.maxRetries;
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set Bearer token for authentication
   */
  setBearerToken(token: string): void {
    this.bearerToken = token;
  }

  /**
   * Add a request interceptor
   * @example
   * client.addRequestInterceptor((req) => {
   *   req.headers = { ...req.headers, 'X-Custom-Header': 'value' };
   *   return req;
   * });
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor
   * @example
   * client.addResponseInterceptor((response, data) => {
   *   console.log('Response:', data);
   *   return data;
   * });
   */
  addResponseInterceptor<T>(interceptor: ResponseInterceptor<T>): void {
    this.responseInterceptors.push(interceptor as ResponseInterceptor);
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(maxRetries: number, delay: number = 1000): void {
    this.maxRetries = maxRetries;
    this.retryDelay = delay;
  }

  /**
   * Internal fetch method with interceptors, auth, and retry logic
   */
  private async internalFetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    let request: RequestInit = { ...options, headers };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      request = await interceptor(request);
    }

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, request);

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw Object.assign(new Error(`API error: ${response.status} ${errorText}`), {
            status: response.status,
            data: errorText,
          });
        }

        const data = await response.json() as T;

        // Apply response interceptors
        let processedData = data;
        for (const interceptor of this.responseInterceptors) {
          processedData = await interceptor(response, processedData) as T;
        }

        return processedData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * GET /vector.json
   *
   * Query endpoint at /vector.json
   *
   * @param query - Query parameters
   * @param query.key - Query parameter: key (required)
   * @param query.layer - Query parameter: layer (required)
   * @param query.x - Query parameter: x (required)
   * @param query.y - Query parameter: y (required)
   * @returns Promise resolving to API result with type-safe success/error handling
   *
   * @example
   * ```typescript
   * const result = await client.vectorjson({ key: "value", layer: 10 });
   * if (result._tag === 'Success') {
   *   console.log(result.data);
   * } else {
   *   console.error('Error:', result.status, result.message);
   * }
   * ```
   */
  async vectorjson<
    TResponse = Record<string, unknown>
  >(
    query: { key: string; layer: number; x: string; y: string }
  ): Promise<ApiResult<TResponse, 400 | 401 | 500>> {
    const url = `${this.baseUrl}/vector.json`;
    const searchParams = new URLSearchParams();
    if (query) {
      if (query.key !== undefined) searchParams.set('key', String(query.key));
      if (query.layer !== undefined) searchParams.set('layer', String(query.layer));
      if (query.x !== undefined) searchParams.set('x', String(query.x));
      if (query.y !== undefined) searchParams.set('y', String(query.y));
    }
    const queryString = searchParams.toString();
    const finalUrl = queryString ? `${url}?${queryString}` : url;

    const options: RequestInit = {
      method: 'GET',
    };

    try {
      const data = await this.internalFetch<Record<string, unknown>>(finalUrl, options);
      return { _tag: 'Success' as const, data };
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
    return {
      _tag: 'ApiError' as const,
      status: (error as any).status as number,
      message: error.message,
      data: (error as any).data,
    };
      }
      return {
    _tag: 'ApiError' as const,
    status: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

}

export default GovtAPIClient;
