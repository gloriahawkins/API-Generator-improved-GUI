/**
 * OpenAPI Specification Parser
 * 
 * This class parses an OpenAPI 3.0 JSON specification and extracts:
 * - All API endpoints (paths + HTTP methods)
 * - Schema definitions (for type generation)
 * - Base URLs and server information
 * 
 * The parser transforms the OpenAPI structure into a format that the
 * code generator can easily work with.
 */

// TypeScript Concepts:
// - Type-only import: import type { ... } - imports only types, removed at compile time
// - Named type imports: OpenAPISpec, Endpoint, Schema - these are interfaces/types defined in types.ts

import type { OpenAPISpec, Endpoint, Schema } from './types.js';

/**
 * Parses OpenAPI specification and extracts endpoints
 * 
 * This class takes a raw OpenAPI JSON object and provides methods to:
 * - Extract all endpoints with their parameters, request bodies, and responses
 * - Resolve schema references ($ref)
 * - Access schemas for type generation
 * - Get base URL from server configuration
 */
// TypeScript Concepts:
// - Class: export class - defines a class that can be imported by other modules
// - Private properties: private spec - only accessible within this class
// - Generic type: Map<string, Schema> - Map is a generic type with key type (string) and value type (Schema)
// - Type initialization: = new Map() - initializes with empty Map, TypeScript infers the generic types

export class OpenAPIParser {
  // The complete OpenAPI specification object
  private spec: OpenAPISpec;
  
  // Map of schema name to schema definition
  // Using Map instead of object for better performance and clearer intent
  // Key: schema name (e.g., "User")
  // Value: the schema definition
  private schemas: Map<string, Schema> = new Map();

  /**
   * Constructor - initializes parser with OpenAPI spec
   * @param spec - The OpenAPI specification object (parsed from JSON)
   */
  constructor(spec: OpenAPISpec) {
    this.spec = spec;
    // Load all schemas into the map for quick lookup
    this.loadSchemas();
  }

  /**
   * Loads all schemas from the OpenAPI spec into the schemas map
   * 
   * Schemas are defined in components.schemas in the OpenAPI spec.
   * We store them in a Map for O(1) lookup when resolving $ref references.
   * 
   * Example OpenAPI structure:
   * components:
   *   schemas:
   *     User:
   *       type: object
   *       properties:
   *         name: { type: string }
   */
  // TypeScript Concepts:
  // - Return type annotation: : void - function doesn't return a value
  // - Optional chaining: ?. - safely accesses properties that might be undefined
  // - Type narrowing: after if check, TypeScript knows schemas exists
  // - Destructuring in for loop: const [name, schema] - extracts key-value pairs
  // - Type inference: TypeScript infers name is string, schema is Schema from Object.entries
  private loadSchemas(): void {
    // Optional chaining (?.) safely handles if components doesn't exist
    // This is common in OpenAPI specs that don't define schemas
    if (this.spec.components?.schemas) {
      // Object.entries() converts { User: {...}, Product: {...} } to
      // [['User', {...}], ['Product', {...}]]
      // We destructure to get [name, schema] pairs
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        // Store in Map for fast lookup
        this.schemas.set(name, schema);
      }
    }
  }

  /**
   * Extract all endpoints from the OpenAPI spec
   * 
   * This is the main method that converts OpenAPI paths into Endpoint objects.
   * 
   * OpenAPI structure:
   * paths:
   *   /users:
   *     get:
   *       operationId: getUser
   *       parameters: [...]
   *     post:
   *       operationId: createUser
   * 
   * This method converts each path + method combination into an Endpoint object.
   * 
   * @returns Array of all endpoints found in the spec
   */
  // TypeScript Concepts:
  // - Return type annotation: : Endpoint[] - returns an array of Endpoint objects
  // - Array type syntax: Endpoint[] - alternative to Array<Endpoint>
  // - Literal union type: 'get' | 'post' | 'put' | 'patch' | 'delete' - must be exactly one of these string values
  // - Array generic syntax: Array<...> - alternative to [...] syntax
  public extractEndpoints(): Endpoint[] {
    const endpoints: Endpoint[] = [];

    // Iterate through all paths in the OpenAPI spec
    // Object.entries() gives us [path, pathItem] pairs
    // Example: ['/users', { get: {...}, post: {...} }]
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      // Array of HTTP methods we support
      // Type is a literal union - must be exactly one of these strings
      // TypeScript Concepts:
      // - Literal union type: restricts values to specific strings
      // - Type safety: TypeScript will error if you try to use a value not in the union
      const methods: Array<'get' | 'post' | 'put' | 'patch' | 'delete'> = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
      ];

      // Check each HTTP method to see if it's defined for this path
      for (const method of methods) {
        // Get the operation for this method (might be undefined)
        const operation = pathItem[method];
        
        // Skip if this method isn't defined for this path
        if (!operation) continue;

        // Operation ID is a unique identifier for this endpoint
        // If not provided, generate one from method + path
        const operationId =
          operation.operationId ||
          this.generateOperationId(method, path);

        // Parameters can be defined at path level (shared) or operation level (specific)
        // Combine both using spread operator
        // Example: path has { id: number }, operation adds { include?: string }
        // TypeScript Concepts:
        // - Spread operator: ...array - spreads array elements into new array
        // - Default value: || [] - provides empty array if undefined
        // - Type inference: TypeScript infers allParameters is Parameter[]
        const allParameters = [
          ...(pathItem.parameters || []),  // Path-level parameters
          ...(operation.parameters || []), // Operation-level parameters
        ];

        // Create Endpoint object with all the information
        endpoints.push({
          method,  // HTTP method (get, post, etc.)
          path,    // URL path (e.g., "/users/{id}")
          operationId,  // Unique identifier
          summary: operation.summary,  // Short description
          description: operation.description,  // Long description
          parameters: allParameters,  // Combined parameters
          requestBody: operation.requestBody,  // Request body (if any)
          responses: operation.responses,  // Response definitions
          tags: operation.tags,  // Tags for grouping
        });
      }
    }

    return endpoints;
  }

  /**
   * Generates an operationId from method and path if not provided
   * 
   * OpenAPI allows omitting operationId, but we need one for method names.
   * This generates a camelCase identifier.
   * 
   * Examples:
   * - GET /users -> "getUsers"
   * - POST /users/{id}/posts -> "postUsersIdPosts"
   * 
   * @param method - HTTP method (get, post, etc.)
   * @param path - URL path (e.g., "/users/{id}")
   * @returns Generated operation ID
   */
  private generateOperationId(
    method: string,
    path: string
  ): string {
    // Split path into parts: "/users/{id}" -> ["", "users", "{id}"]
    const pathParts = path
      .split('/')
      // Remove empty strings (from leading/trailing slashes)
      .filter(Boolean)
      // Remove curly braces from path parameters: "{id}" -> "id"
      .map((part) => part.replace(/[{}]/g, ''))
      // Capitalize first letter: "users" -> "Users", "id" -> "Id"
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

    // Combine: "get" + "Users" + "Id" = "getUsersId"
    return method.toLowerCase() + pathParts.join('');
  }

  /**
   * Resolve a schema reference ($ref) to the actual schema
   * 
   * OpenAPI allows schemas to reference other schemas:
   * { $ref: '#/components/schemas/User' }
   * 
   * This method looks up the referenced schema in our schemas map.
   * If it's not a reference, returns the schema as-is.
   * 
   * @param schema - Schema that might be a reference
   * @returns The actual schema definition (resolved if it was a reference)
   */
  // TypeScript Concepts:
  // - Type guard: 'in' operator - checks if property exists, TypeScript narrows type after check
  // - Type narrowing: after if ('$ref' in schema), TypeScript knows schema has $ref property
  // - Map.get(): returns value or undefined, so we use || for fallback
  public resolveSchema(schema: Schema): Schema {
    // Type guard: check if this is a reference schema
    // 'in' operator checks if property exists
    if ('$ref' in schema) {
      const ref = schema.$ref;  // e.g., "#/components/schemas/User"
      
      // Extract just the schema name from the reference path
      const schemaName = ref.replace('#/components/schemas/', '');
      
      // Look up in our schemas map
      // .get() returns the schema or undefined if not found
      // || schema provides fallback to original if not found
      return this.schemas.get(schemaName) || schema;
    }
    
    // Not a reference, return as-is
    return schema;
  }

  /**
   * Returns the preferred base URL declared in the spec. We follow the
   * conventional “first server wins” approach and fall back to a placeholder so
   * the generated client still compiles even when no servers are defined.
   */
  public getBaseUrl(): string {
    if (this.spec.servers && this.spec.servers.length > 0) {
      return this.spec.servers[0].url;
    }
    return 'https://api.example.com';
  }

  /**
   * Provide read-only access to the schema map so the generator can ask for
   * definitions while preserving the parser’s responsibility of resolving refs.
   */
  // TypeScript Concepts:
  // - Return type annotation: : Map<string, Schema> - explicitly declares return type
  // - Generic return type: Map is generic with key and value types
  public getSchemas(): Map<string, Schema> {
    return this.schemas;
  }
}

