/**
 * TypeScript Client Code Generator
 * 
 * This class generates fully type-safe TypeScript client code from OpenAPI specifications.
 * It converts OpenAPI schemas to TypeScript types and creates a class with typed methods
 * for each API endpoint.
 * 
 * Key features:
 * - Recursive schema-to-type conversion (handles nested objects, arrays, circular refs)
 * - Discriminated unions for type-safe error handling
 * - Generics for flexible, type-safe method signatures
 * - Request/response interceptors
 * - Automatic retry logic with exponential backoff
 * - Full JSDoc documentation generation
 */

import type { Endpoint, Schema, Parameter, RequestBody } from './types.js';
import { OpenAPIParser } from './parser.js';

/**
 * Generates type-safe TypeScript client code from OpenAPI endpoints
 * 
 * This is a code generator - it writes TypeScript code as strings, which will
 * be written to a file and used as a type-safe API client.
 */
export class TypeScriptClientGenerator {
  // Parser instance that extracts endpoints and schemas from OpenAPI spec
  private parser: OpenAPIParser;
  
  // Tracks current indentation level when generating code (for formatting)
  private indentLevel = 0;
  
  // The string used for indentation (2 spaces)
  // readonly means it can't be reassigned after initialization
  private readonly indentStr = '  ';

  /**
   * Constructor - takes a parser that has already loaded an OpenAPI spec
   * @param parser - Parser instance with loaded OpenAPI specification
   */
  constructor(parser: OpenAPIParser) {
    this.parser = parser;
  }

  /**
   * Main entry point - generates the complete TypeScript client code
   * 
   * This method orchestrates the entire code generation process:
   * 1. Extracts endpoints from OpenAPI spec
   * 2. Generates type definitions from schemas
   * 3. Generates the client class with all methods
   * 4. Returns the complete code as a string
   * 
   * @returns Complete TypeScript code as a string (ready to write to file)
   */
  public generate(): string {
    // Extract all API endpoints (GET /users, POST /products, etc.)
    const endpoints = this.parser.extractEndpoints();
    
    // Get the base URL from the OpenAPI spec (e.g., "https://api.example.com")
    const baseUrl = this.parser.getBaseUrl();
    
    // Generate a class name from the OpenAPI title (e.g., "PetstoreClient")
    const className = this.generateClassName();

    // Build the code string by concatenating all parts
    // Header includes imports, type definitions, and discriminated union types
    let code = this.generateHeader(className);
    
    // Generate TypeScript type definitions from OpenAPI schemas
    code += this.generateTypes();
    
    // Generate the main client class with all endpoint methods
    code += this.generateClientClass(className, baseUrl, endpoints);
    
    // Add export statement at the end
    code += this.generateExports(className);

    return code;
  }

  /**
   * Generates the header section of the generated code
   * 
   * This includes:
   * - File header comment explaining what the client provides
   * - Discriminated union types for error handling (ApiResult, ApiError, ApiSuccess)
   * - Interceptor type definitions
   * 
   * Discriminated unions use a _tag property to help TypeScript narrow types.
   * When you check `result._tag === 'Success'`, TypeScript knows result.data exists.
   * This forces proper error handling at compile time.
   * 
   * @param _className - Class name (unused, kept for consistency)
   * @returns Header code as string
   */
  private generateHeader(_className: string): string {
    return `/**
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

`;
  }

  /**
   * Generates TypeScript type definitions from OpenAPI schemas
   * 
   * Iterates through all schemas in the OpenAPI spec and converts each to
   * a TypeScript type. These types are exported so users can reference them
   * in their own code.
   * 
   * Example output:
   * export type User = {
   *   id: number;
   *   name: string;
   *   email?: string;
   * };
   * 
   * @returns String containing all type definitions
   */
  private generateTypes(): string {
    // Get all schemas from the parser (stored as Map<string, Schema>)
    const schemas = this.parser.getSchemas();
    
    // Start building the types string
    let types = '// Type definitions\n\n';

    // Iterate through each schema and convert it to TypeScript
    // Map.entries() returns [key, value] pairs, which we destructure
    for (const [name, schema] of schemas.entries()) {
      // Convert OpenAPI schema to TypeScript type string
      // schemaToType is recursive and handles nested structures
      types += `export type ${name} = ${this.schemaToType(schema)};\n\n`;
    }

    return types;
  }

  /**
   * Recursively converts an OpenAPI schema to a TypeScript type string
   * 
   * This is the core of the type generation. It handles:
   * - Primitive types (string, number, boolean)
   * - Arrays (recursively processes item type)
   * - Objects (recursively processes each property)
   * - Enums (converts to union of string literals)
   * - References ($ref) - resolves and tracks circular references
   * - oneOf/allOf/anyOf - converts to union/intersection types
   * 
   * The function is recursive because schemas can be deeply nested:
   * - Objects contain properties that are schemas
   * - Arrays contain item schemas
   * - References point to other schemas
   * 
   * @param schema - The OpenAPI schema to convert
   * @param visited - Set of schema names we've already processed (prevents infinite loops)
   * @returns TypeScript type string (e.g., "string", "User", "{ name: string }")
   * 
   * Example transformations:
   * - { type: 'string' } -> "string"
   * - { type: 'string', enum: ['a', 'b'] } -> '"a" | "b"'
   * - { type: 'array', items: { type: 'string' } } -> "Array<string>"
   * - { type: 'object', properties: { name: { type: 'string' } } } -> "{ name: string }"
   */
  private schemaToType(schema: Schema, visited: Set<string> = new Set()): string {
    // First, resolve any $ref references to get the actual schema
    const resolved = this.parser.resolveSchema(schema);

    // ========================================================================
    // HANDLE SCHEMA REFERENCES ($ref)
    // ========================================================================
    // OpenAPI allows schemas to reference other schemas using $ref
    // Example: { $ref: '#/components/schemas/User' }
    // We need to resolve these and handle circular references
    
    // Type guard: check if this is a reference schema
    // 'in' operator checks if property exists in object
    if ('$ref' in resolved) {
      const ref = resolved.$ref;  // e.g., "#/components/schemas/User"
      
      // Extract just the schema name from the reference path
      const typeName = ref.replace('#/components/schemas/', '');
      
      // ====================================================================
      // CIRCULAR REFERENCE DETECTION
      // ====================================================================
      // If we've already visited this schema name, we're in a cycle.
      // Example: User has property 'parent' of type User
      // Solution: Return just the type name, which TypeScript will resolve
      // when the type is defined elsewhere in the generated code
      if (visited.has(typeName)) {
        return typeName; // Break the cycle by returning type name
      }
      
      // Look up the referenced schema in our schemas map
      const referencedSchema = this.parser.getSchemas().get(typeName);
      if (referencedSchema) {
        // Create a new Set with the current type added (immutable pattern)
        // This tracks our path through the schema graph
        const newVisited = new Set(visited);
        newVisited.add(typeName);
        
        // Recursively process the referenced schema
        return this.schemaToType(referencedSchema, newVisited);
      }
      
      // If schema not found, just return the type name (will be defined elsewhere)
      return typeName;
    }

    // ========================================================================
    // HANDLE TYPED SCHEMAS (string, number, boolean, array, object)
    // ========================================================================
    // Type guard: check if schema has a 'type' property
    if ('type' in resolved) {
      switch (resolved.type) {
        // ====================================================================
        // STRING TYPE
        // ====================================================================
        case 'string':
          // If there's an enum, create a union of string literals
          // Example: enum: ['active', 'inactive'] -> '"active" | "inactive"'
          if (resolved.enum) {
            // Map each enum value to a string literal, join with union operator
            return resolved.enum.map((v) => `"${v}"`).join(' | ');
          }
          // No enum, just a regular string type
          return 'string';
        
        // ====================================================================
        // NUMBER TYPE
        // ====================================================================
        // OpenAPI distinguishes 'number' (float) and 'integer' (int), but
        // TypeScript only has 'number' for both
        case 'number':
        case 'integer':
          return 'number';
        
        // ====================================================================
        // BOOLEAN TYPE
        // ====================================================================
        case 'boolean':
          return 'boolean';
        
        // ====================================================================
        // ARRAY TYPE
        // ====================================================================
        // Arrays require recursive processing of the items schema
        // Example: { type: 'array', items: { type: 'string' } } -> "Array<string>"
        case 'array':
          // Recursively convert the items schema to a type
          return `Array<${this.schemaToType(resolved.items, visited)}>`;
        
        // ====================================================================
        // OBJECT TYPE
        // ====================================================================
        // Objects are the most complex - need to process each property
        case 'object':
          // If no properties defined, it's an empty object or any object
          // Record<string, unknown> means "object with string keys and any values"
          if (!resolved.properties) {
            return 'Record<string, unknown>';
          }
          
          // Convert each property to TypeScript property syntax
          // Object.entries() converts { name: schema } to [['name', schema]]
          const props = Object.entries(resolved.properties)
            .map(([key, value]) => {
              // Check if this property is in the 'required' array
              // Optional chaining (?.) safely handles if required is undefined
              const isRequired = resolved.required?.includes(key);
              
              // Add '?' if property is optional (not in required array)
              const optional = isRequired ? '' : '?';
              
              // Recursively convert property schema to type
              // Format: "  name?: string;" or "  name: string;"
              return `  ${key}${optional}: ${this.schemaToType(value, visited)};`;
            })
            .join('\n');  // Join all properties with newlines
          
          // Return formatted object type
          return `{\n${props}\n}`;
      }
    }

    // ========================================================================
    // HANDLE SCHEMA COMBINATIONS (oneOf, allOf, anyOf)
    // ========================================================================
    // These OpenAPI features allow combining multiple schemas
    
    // oneOf: Value must match exactly ONE of the schemas (union type)
    // Example: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    // -> "string | number"
    if ('oneOf' in resolved) {
      // Convert each schema to a type, join with union operator
      return resolved.oneOf.map((s) => this.schemaToType(s, visited)).join(' | ');
    }

    // allOf: Value must match ALL schemas (intersection type)
    // Example: { allOf: [{ type: 'object', properties: { name: ... } }, { type: 'object', properties: { age: ... } }] }
    // -> "{ name: string } & { age: number }" (combines properties)
    if ('allOf' in resolved) {
      // Convert each schema to a type, join with intersection operator
      return resolved.allOf.map((s) => this.schemaToType(s, visited)).join(' & ');
    }

    // anyOf: Value can match ANY of the schemas (union type, like oneOf)
    // TypeScript doesn't distinguish, so we treat it the same as oneOf
    if ('anyOf' in resolved) {
      return resolved.anyOf.map((s) => this.schemaToType(s, visited)).join(' | ');
    }

    // Fallback: if we can't determine the type, use 'unknown'
    // This is safer than 'any' because it forces type checking
    return 'unknown';
  }

  /**
   * Generates the main client class with all properties and methods
   * 
   * This creates a TypeScript class that:
   * - Stores configuration (baseUrl, auth tokens, retry settings)
   * - Has methods for each API endpoint (generated from OpenAPI spec)
   * - Includes helper methods (auth, interceptors, retry config)
   * - Has an internal fetch method with retry logic and interceptors
   * 
   * @param className - Name of the class (e.g., "PetstoreClient")
   * @param baseUrl - Base URL for all API calls
   * @param endpoints - Array of all endpoints to generate methods for
   * @returns Complete class definition as string
   */
  private generateClientClass(
    className: string,
    baseUrl: string,
    endpoints: Endpoint[]
  ): string {
    // Start the class definition
    let code = `export class ${className} {\n`;
    this.indentLevel++;  // Increase indent for class body

    // ========================================================================
    // CLASS PROPERTIES
    // ========================================================================
    // These are private to encapsulate internal state
    
    // Base URL for all API requests
    code += this.indent() + `private baseUrl: string = "${baseUrl}";\n`;
    
    // Optional authentication - can be set via setApiKey() or setBearerToken()
    // The '?' makes these optional properties
    code += this.indent() + `private apiKey?: string;\n`;
    code += this.indent() + `private bearerToken?: string;\n`;
    
    // Interceptor arrays - functions that modify requests/responses
    // Array type syntax: Type[] means array of Type
    code += this.indent() + `private requestInterceptors: RequestInterceptor[] = [];\n`;
    code += this.indent() + `private responseInterceptors: ResponseInterceptor[] = [];\n`;
    
    // Retry configuration - exponential backoff settings
    code += this.indent() + `private maxRetries: number = 3;\n`;
    code += this.indent() + `private retryDelay: number = 1000;\n\n`;

    // ========================================================================
    // CLASS METHODS
    // ========================================================================
    // Generate all the methods that make up the class
    
    // Constructor - allows passing initial config
    code += this.generateConstructor();
    
    // Authentication methods - set API key or bearer token
    code += this.generateAuthMethods();
    
    // Interceptor methods - add request/response interceptors
    code += this.generateInterceptorMethods();
    
    // Retry configuration method
    code += this.generateRetryMethods();
    
    // Internal fetch method - handles all HTTP requests with retry logic
    code += this.generateInternalFetchMethod(baseUrl, className);

    // ========================================================================
    // ENDPOINT METHODS
    // ========================================================================
    // Generate a typed method for each API endpoint
    // These are the main API the user will interact with
    for (const endpoint of endpoints) {
      code += this.generateEndpointMethod(endpoint);
    }

    // Close the class
    this.indentLevel--;
    code += '}\n\n';

    return code;
  }

  /**
   * Emit a constructor that accepts optional configuration values. During a
   * walkthrough, it's useful to call out that this mirrors the fluent setter
   * methods, so the comment explicitly states which knobs can be set up front.
   */
  private generateConstructor(): string {
    return this.indent() + `constructor(config?: {\n` +
      this.indent(2) + `baseUrl?: string;\n` +
      this.indent(2) + `apiKey?: string;\n` +
      this.indent(2) + `bearerToken?: string;\n` +
      this.indent(2) + `maxRetries?: number;\n` +
      this.indent() + `}) {\n` +
      this.indent(2) + `if (config?.baseUrl) this.baseUrl = config.baseUrl;\n` +
      this.indent(2) + `if (config?.apiKey) this.apiKey = config.apiKey;\n` +
      this.indent(2) + `if (config?.bearerToken) this.bearerToken = config.bearerToken;\n` +
      this.indent(2) + `if (config?.maxRetries !== undefined) this.maxRetries = config.maxRetries;\n` +
      this.indent() + `}\n\n`;
  }

  /**
   * Document the intent of the authentication helpers so it is obvious that the
   * client supports both API keys and bearer tokens without needing to inspect
   * the generated output.
   */
  private generateAuthMethods(): string {
    return this.indent() + `/**\n` +
      this.indent() + ` * Set API key for authentication\n` +
      this.indent() + ` */\n` +
      this.indent() + `setApiKey(apiKey: string): void {\n` +
      this.indent(2) + `this.apiKey = apiKey;\n` +
      this.indent() + `}\n\n` +
      this.indent() + `/**\n` +
      this.indent() + ` * Set Bearer token for authentication\n` +
      this.indent() + ` */\n` +
      this.indent() + `setBearerToken(token: string): void {\n` +
      this.indent(2) + `this.bearerToken = token;\n` +
      this.indent() + `}\n\n`;
  }

  /**
   * Request/response interceptors are a major selling point. This helper emits
   * both mutators plus rich comments so reviewers understand how to hook into
   * the pipeline.
   */
  private generateInterceptorMethods(): string {
    return this.indent() + `/**\n` +
      this.indent() + ` * Add a request interceptor\n` +
      this.indent() + ` * @example\n` +
      this.indent() + ` * client.addRequestInterceptor((req) => {\n` +
      this.indent() + ` *   req.headers = { ...req.headers, 'X-Custom-Header': 'value' };\n` +
      this.indent() + ` *   return req;\n` +
      this.indent() + ` * });\n` +
      this.indent() + ` */\n` +
      this.indent() + `addRequestInterceptor(interceptor: RequestInterceptor): void {\n` +
      this.indent(2) + `this.requestInterceptors.push(interceptor);\n` +
      this.indent() + `}\n\n` +
      this.indent() + `/**\n` +
      this.indent() + ` * Add a response interceptor\n` +
      this.indent() + ` * @example\n` +
      this.indent() + ` * client.addResponseInterceptor((response, data) => {\n` +
      this.indent() + ` *   console.log('Response:', data);\n` +
      this.indent() + ` *   return data;\n` +
      this.indent() + ` * });\n` +
      this.indent() + ` */\n` +
      this.indent() + `addResponseInterceptor<T>(interceptor: ResponseInterceptor<T>): void {\n` +
      this.indent(2) + `this.responseInterceptors.push(interceptor as ResponseInterceptor);\n` +
      this.indent() + `}\n\n`;
  }

  /**
   * Provide a dedicated method for tuning retries (rather than forcing direct
   * property access). The comment makes it clear that retries default to
   * exponential backoff tuned via `maxRetries`/`retryDelay`.
   */
  private generateRetryMethods(): string {
    return this.indent() + `/**\n` +
      this.indent() + ` * Set retry configuration\n` +
      this.indent() + ` */\n` +
      this.indent() + `setRetryConfig(maxRetries: number, delay: number = 1000): void {\n` +
      this.indent(2) + `this.maxRetries = maxRetries;\n` +
      this.indent(2) + `this.retryDelay = delay;\n` +
      this.indent() + `}\n\n`;
  }

  /**
   * Centralizes all network concerns—auth headers, interceptors, retry loop,
   * and JSON parsing—so each endpoint method can remain tiny. The walkthrough
   * can lean on this explanation to describe the runtime behavior.
   */
  private generateInternalFetchMethod(baseUrl: string, className: string): string {
    // Detect if this is OpenAI API (uses Bearer token for API keys)
    const isOpenAI = baseUrl.includes('openai.com') || className.toLowerCase().includes('openai');
    
    return this.indent() + `/**\n` +
      this.indent() + ` * Internal fetch method with interceptors, auth, and retry logic\n` +
      this.indent() + ` */\n` +
      this.indent() + `private async internalFetch<T>(\n` +
      this.indent(2) + `url: string,\n` +
      this.indent(2) + `options: RequestInit = {}\n` +
      this.indent() + `): Promise<T> {\n` +
      this.indent(2) + `// Build headers\n` +
      this.indent(2) + `const headers: HeadersInit = {\n` +
      this.indent(3) + `'Content-Type': 'application/json',\n` +
      this.indent(3) + `...options.headers,\n` +
      this.indent(2) + `};\n\n` +
      this.indent(2) + `// Add authentication\n` +
      (isOpenAI 
        ? this.indent(2) + `// OpenAI uses Bearer token for API keys\n` +
          this.indent(2) + `if (this.apiKey) {\n` +
          this.indent(3) + `headers['Authorization'] = \`Bearer \${this.apiKey}\`;\n` +
          this.indent(2) + `}\n` +
          this.indent(2) + `if (this.bearerToken) {\n` +
          this.indent(3) + `headers['Authorization'] = \`Bearer \${this.bearerToken}\`;\n` +
          this.indent(2) + `}\n\n`
        : this.indent(2) + `if (this.apiKey) {\n` +
          this.indent(3) + `headers['X-API-Key'] = this.apiKey;\n` +
          this.indent(2) + `}\n` +
          this.indent(2) + `if (this.bearerToken) {\n` +
          this.indent(3) + `headers['Authorization'] = \`Bearer \${this.bearerToken}\`;\n` +
          this.indent(2) + `}\n\n`) +
      this.indent(2) + `let request: RequestInit = { ...options, headers };\n\n` +
      this.indent(2) + `// Apply request interceptors\n` +
      this.indent(2) + `for (const interceptor of this.requestInterceptors) {\n` +
      this.indent(3) + `request = await interceptor(request);\n` +
      this.indent(2) + `}\n\n` +
      this.indent(2) + `// Retry logic with exponential backoff\n` +
      this.indent(2) + `let lastError: Error | null = null;\n` +
      this.indent(2) + `for (let attempt = 0; attempt <= this.maxRetries; attempt++) {\n` +
      this.indent(3) + `try {\n` +
      this.indent(4) + `const response = await fetch(url, request);\n\n` +
      this.indent(4) + `if (!response.ok) {\n` +
      this.indent(5) + `const errorText = await response.text().catch(() => response.statusText);\n` +
      this.indent(5) + `throw Object.assign(new Error(\`API error: \${response.status} \${errorText}\`), {\n` +
      this.indent(6) + `status: response.status,\n` +
      this.indent(6) + `data: errorText,\n` +
      this.indent(5) + `});\n` +
      this.indent(4) + `}\n\n` +
      this.indent(4) + `const data = await response.json() as T;\n\n` +
      this.indent(4) + `// Apply response interceptors\n` +
      this.indent(4) + `let processedData = data;\n` +
      this.indent(4) + `for (const interceptor of this.responseInterceptors) {\n` +
      this.indent(5) + `processedData = await interceptor(response, processedData) as T;\n` +
      this.indent(4) + `}\n\n` +
      this.indent(4) + `return processedData;\n` +
      this.indent(3) + `} catch (error) {\n` +
      this.indent(4) + `lastError = error instanceof Error ? error : new Error(String(error));\n` +
      this.indent(4) + `if (attempt < this.maxRetries) {\n` +
      this.indent(5) + `const delay = this.retryDelay * Math.pow(2, attempt);\n` +
      this.indent(5) + `await new Promise(resolve => setTimeout(resolve, delay));\n` +
      this.indent(4) + `} else {\n` +
      this.indent(5) + `throw lastError;\n` +
      this.indent(4) + `}\n` +
      this.indent(3) + `}\n` +
      this.indent(2) + `}\n\n` +
      this.indent(2) + `throw lastError || new Error('Unknown error');\n` +
      this.indent() + `}\n\n`;
  }

  /**
   * Generates a typed method for a single API endpoint
   * 
   * This is where the magic happens - each endpoint becomes a fully typed
   * method with:
   * - Typed parameters (path, query, body)
   * - Typed return value (ApiResult with discriminated union)
   * - JSDoc documentation with examples
   * - Proper error handling
   * 
   * Example generated method:
   * async getUser(params: { id: number }, query?: { include?: string }): Promise<ApiResult<User>> {
   *   // ... implementation
   * }
   * 
   * @param endpoint - The endpoint to generate a method for
   * @returns Complete method definition as string
   */
  /**
   * Convert a single OpenAPI endpoint into a strongly typed method, including
   * docs, generics, runtime plumbing, and discriminated-union return types.
   */
  private generateEndpointMethod(endpoint: Endpoint): string {
    // Convert operationId to a valid TypeScript method name
    // Example: "getUserById" -> "get_user_by_id"
    const methodName = this.sanitizeMethodName(endpoint.operationId);
    
    // Separate parameters by location (path vs query)
    // .filter() creates new array with matching elements
    // Arrow function (p) => p.in === 'path' is a type guard
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');
    const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
    
    // Check if endpoint has a request body
    // !! converts truthy/falsy to boolean
    const hasBody = !!endpoint.requestBody;

    // ========================================================================
    // GENERATE TYPESCRIPT TYPES FOR PARAMETERS AND RESPONSE
    // ========================================================================
    // These will be used in the method signature for full type safety
    
    // Path params type: { userId: number, postId: string }
    const pathType = this.generatePathParamsType(pathParams, endpoint.path);
    
    // Query params type: { limit?: number, offset?: number }
    const queryType = this.generateQueryParamsType(queryParams);
    
    // Request body type: User | CreateUserRequest | null
    const bodyType = hasBody
      ? this.extractRequestBodyType(endpoint.requestBody!)
      : null;
    
    // Response type: User | Product[] | etc.
    const responseType = this.extractResponseType(endpoint.responses);
    
    // Error status codes: 404 | 500 | null
    const errorTypes = this.extractErrorTypes(endpoint.responses);

    // ========================================================================
    // GENERATE JSDOC DOCUMENTATION
    // ========================================================================
    // Includes description, parameter docs, return type, and usage example
    let method = this.generateJSDoc(endpoint, pathParams, queryParams, bodyType, responseType);
    
    // ========================================================================
    // GENERATE METHOD SIGNATURE WITH GENERICS
    // ========================================================================
    // Generics allow type inference while maintaining type safety
    // TParams extends pathType ensures path params match the expected shape
    // TResponse defaults to the inferred response type but can be overridden
    
    // Method is async (returns Promise)
    method += this.indent() + `async ${methodName}<\n`;
    
    // Only add TParams generic if there are path parameters
    // extends creates a constraint - TParams must match pathType
    // = provides a default value
    if (pathParams.length > 0) {
      method += this.indent(2) + `TParams extends ${pathType} = ${pathType},\n`;
    }
    
    // Response type generic with default
    method += this.indent(2) + `TResponse = ${responseType}\n`;
    method += this.indent() + `>(\n`;

    // Parameters with better typing
    const params: string[] = [];
    if (pathParams.length > 0) {
      params.push(`params: TParams`);
    }
    if (queryParams.length > 0) {
      const required = queryParams.some((p) => p.required);
      params.push(`query${required ? '' : '?'}: ${queryType}`);
    }
    if (bodyType) {
      params.push(`body: ${bodyType}`);
    }

    method += this.indent(2) + params.join(',\n' + this.indent(2)) + '\n';
    
    // Return type with discriminated union for errors
    method += this.indent() + `): Promise<ApiResult<TResponse${errorTypes ? `, ${errorTypes}` : ''}>> {\n`;

    this.indentLevel++;

    // Generate URL with template literal types
    method += this.generateUrlConstruction(endpoint.path, pathParams);
    
    // Use internal fetch method
    method += this.generateAdvancedFetchCall(endpoint.method, queryParams, hasBody, responseType);

    this.indentLevel--;
    method += this.indent() + `}\n\n`;

    return method;
  }

  /**
   * Emit the multi-line JSDoc that ships with every endpoint method so callers
   * understand the parameters and see a runnable example.
   */
  private generateJSDoc(
    endpoint: Endpoint,
    pathParams: Parameter[],
    queryParams: Parameter[],
    bodyType: string | null,
    _responseType: string
  ): string {
    let doc = this.indent() + `/**\n`;
    doc += this.indent() + ` * ${endpoint.summary || endpoint.operationId}\n`;
    if (endpoint.description) {
      doc += this.indent() + ` *\n`;
      doc += this.indent() + ` * ${endpoint.description}\n`;
    }
    doc += this.indent() + ` *\n`;
    
    if (pathParams.length > 0) {
      doc += this.indent() + ` * @param params - Path parameters\n`;
      pathParams.forEach(p => {
        const desc = p.description || p.name;
        doc += this.indent() + ` * @param params.${p.name} - ${desc}\n`;
      });
    }
    
    if (queryParams.length > 0) {
      doc += this.indent() + ` * @param query - Query parameters\n`;
      queryParams.forEach(p => {
        const desc = p.description || p.name;
        doc += this.indent() + ` * @param query.${p.name} - ${desc}${p.required ? ' (required)' : ' (optional)'}\n`;
      });
    }
    
    if (bodyType) {
      doc += this.indent() + ` * @param body - Request body\n`;
    }
    
    doc += this.indent() + ` * @returns Promise resolving to API result with type-safe success/error handling\n`;
    doc += this.indent() + ` *\n`;
    doc += this.indent() + ` * @example\n`;
    
    // Generate example
    let example = `const result = await client.${this.sanitizeMethodName(endpoint.operationId)}(`;
    const exampleParams: string[] = [];
    if (pathParams.length > 0) {
      const examplePath = pathParams.map(p => {
        const schema = p.schema ? this.parser.resolveSchema(p.schema) : null;
        const isInt = schema && 'type' in schema && (schema.type === 'integer' || schema.type === 'number');
        return `${p.name}: ${isInt ? '123' : '"value"'}`;
      }).join(', ');
      exampleParams.push(`{ ${examplePath} }`);
    }
    if (queryParams.length > 0) {
      const exampleQuery = queryParams.slice(0, 2).map(p => {
        const schema = p.schema ? this.parser.resolveSchema(p.schema) : null;
        const isInt = schema && 'type' in schema && (schema.type === 'integer' || schema.type === 'number');
        return `${p.name}: ${isInt ? '10' : '"value"'}`;
      }).join(', ');
      exampleParams.push(`{ ${exampleQuery} }`);
    }
    if (bodyType) {
      exampleParams.push('{ name: "example", status: "available" }');
    }
    example += exampleParams.join(', ') + ');\n';
    example += `if (result._tag === 'Success') {\n`;
    example += `  console.log(result.data);\n`;
    example += `} else {\n`;
    example += `  console.error('Error:', result.status, result.message);\n`;
    example += `}`;
    
    doc += this.indent() + ` * \`\`\`typescript\n`;
    doc += this.indent() + ` * ${example.split('\n').join('\n' + this.indent() + ' * ')}\n`;
    doc += this.indent() + ` * \`\`\`\n`;
    doc += this.indent() + ` */\n`;
    
    return doc;
  }

  /**
   * Determine whether the responses table includes explicit error status codes
   * so we can surface that information in the `ApiResult` generic.
   */
  private extractErrorTypes(
    responses: Record<string, { description: string; content?: Record<string, { schema?: Schema }> }>
  ): string | null {
    const errorStatuses = Object.keys(responses)
      .filter(status => parseInt(status) >= 400)
      .map(status => parseInt(status));
    
    if (errorStatuses.length === 0) return null;
    if (errorStatuses.length === 1) return `${errorStatuses[0]}`;
    return errorStatuses.join(' | ');
  }

  /**
   * Produce a literal object type for path parameters (or a `never`-ish record
   * if none exist) so the generated method signatures read cleanly.
   */
  private generatePathParamsType(
    params: Parameter[],
    _path: string
  ): string {
    if (params.length === 0) return 'Record<string, never>';

    const props = params
      .map((p) => {
        const type = p.schema
          ? this.schemaToType(this.parser.resolveSchema(p.schema), new Set())
          : 'string';
        return `${p.name}: ${type}`;
      })
      .join('; ');

    return `{ ${props} }`;
  }

  /**
   * Similar to path params but marks optional keys appropriately, which keeps
   * the generated method signature ergonomic.
   */
  private generateQueryParamsType(params: Parameter[]): string {
    if (params.length === 0) return 'Record<string, never>';

    const props = params
      .map((p) => {
        const type = p.schema
          ? this.schemaToType(this.parser.resolveSchema(p.schema), new Set())
          : 'string';
        const optional = p.required ? '' : '?';
        return `${p.name}${optional}: ${type}`;
      })
      .join('; ');

    return `{ ${props} }`;
  }

  /**
   * Currently we only emit JSON bodies—this helper isolates that decision so
   * future enhancements (form data, etc.) have a clear entry point.
   */
  private extractRequestBodyType(requestBody: RequestBody): string {
    const content = requestBody.content;
    if (content['application/json']?.schema) {
      return this.schemaToType(
        this.parser.resolveSchema(content['application/json'].schema!),
        new Set()
      );
    }
    return 'unknown';
  }

  /**
   * Grab the success payload type from the responses table, defaulting to
   * `unknown` when the spec does not return JSON (e.g., 204 No Content).
   */
  private extractResponseType(
    responses: Record<string, { description: string; content?: Record<string, { schema?: Schema }> }>
  ): string {
    // Prefer 200 response
    const successResponse = responses['200'] || responses['201'] || responses['204'];
    if (successResponse?.content?.['application/json']?.schema) {
      return this.schemaToType(
        this.parser.resolveSchema(
          successResponse.content['application/json'].schema!
        ),
        new Set()
      );
    }
    return 'unknown';
  }

  /**
   * Build a template literal that stitches together the base URL and path
   * parameters. The comments explain why `URLSearchParams` is handled elsewhere.
   */
  private generateUrlConstruction(path: string, pathParams: Parameter[]): string {
    if (pathParams.length === 0) {
      return this.indent() + `const url = \`\${this.baseUrl}${path}\`;\n`;
    }

    // Use template literal types for path construction
    const templatePath = path.replace(/\{(\w+)\}/g, '${params.$1}');
    return this.indent() + `const url = \`\${this.baseUrl}${templatePath}\`;\n`;
  }

  /**
   * Shared runtime snippet that handles query serialization, invocation of the
   * internal fetch helper, and consistent `ApiResult` wrapping.
   */
  private generateAdvancedFetchCall(
    method: string,
    queryParams: Parameter[],
    hasBody: boolean,
    responseType: string
  ): string {
    let code = this.indent() + `const searchParams = new URLSearchParams();\n`;

    if (queryParams.length > 0) {
      code += this.indent() + `if (query) {\n`;
      this.indentLevel++;
      for (const param of queryParams) {
        code +=
          this.indent() +
          `if (query.${param.name} !== undefined) searchParams.set('${param.name}', String(query.${param.name}));\n`;
      }
      this.indentLevel--;
      code += this.indent() + `}\n`;
      code += this.indent() + `const queryString = searchParams.toString();\n`;
      code +=
        this.indent() +
        `const finalUrl = queryString ? \`\${url}?\${queryString}\` : url;\n\n`;
    } else {
      code += this.indent() + `const finalUrl = url;\n\n`;
    }

    code += this.indent() + `const options: RequestInit = {\n`;
    this.indentLevel++;
    code += this.indent() + `method: '${method.toUpperCase()}',\n`;
    if (hasBody) {
      code += this.indent() + `body: JSON.stringify(body),\n`;
    }
    this.indentLevel--;
    code += this.indent() + `};\n\n`;

    code += this.indent() + `try {\n`;
    this.indentLevel++;
    code += this.indent() + `const data = await this.internalFetch<${responseType}>(finalUrl, options);\n`;
    code += this.indent() + `return { _tag: 'Success' as const, data };\n`;
    this.indentLevel--;
    code += this.indent() + `} catch (error) {\n`;
    this.indentLevel++;
    code += this.indent() + `if (error instanceof Error && 'status' in error) {\n`;
    code += this.indent(2) + `return {\n`;
    code += this.indent(3) + `_tag: 'ApiError' as const,\n`;
    code += this.indent(3) + `status: (error as any).status as number,\n`;
    code += this.indent(3) + `message: error.message,\n`;
    code += this.indent(3) + `data: (error as any).data,\n`;
    code += this.indent(2) + `};\n`;
    code += this.indent() + `}\n`;
    code += this.indent() + `return {\n`;
    code += this.indent(2) + `_tag: 'ApiError' as const,\n`;
    code += this.indent(2) + `status: 500,\n`;
    code += this.indent(2) + `message: error instanceof Error ? error.message : 'Unknown error',\n`;
    code += this.indent() + `};\n`;
    this.indentLevel--;
    code += this.indent() + `}\n`;

    return code;
  }

  /**
   * Convert arbitrary `operationId` strings into safe method names. The same
   * helper is reused by the example generator to keep output synchronized.
   */
  private sanitizeMethodName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  /**
   * Lifted into a public helper so the CLI/example generator can reuse the
   * class name logic (ensuring both files import/instantiate the same symbol).
   */
  public generateClassName(): string {
    const info = this.parser['spec'].info;
    return (
      info.title
        .replace(/[^a-zA-Z0-9]/g, '')
        .replace(/^[a-z]/, (c) => c.toUpperCase()) + 'Client'
    );
  }

  /**
   * Keep the default export in addition to the named class export—most users
   * will `import { Foo }` but the default mirrors historical behavior.
   */
  private generateExports(className: string): string {
    return `export default ${className};\n`;
  }

  /**
   * Helper for managing indentation that keeps nested template literals
   * readable—passing an explicit level is handy when emitting multi-line blocks.
   */
  private indent(level?: number): string {
    const lvl = level !== undefined ? level : this.indentLevel;
    return this.indentStr.repeat(lvl);
  }
}

