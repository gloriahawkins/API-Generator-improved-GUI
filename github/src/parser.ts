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
  public extractEndpoints(): Endpoint[] {
    const endpoints: Endpoint[] = [];

    // Iterate through all paths in the OpenAPI spec
    // Object.entries() gives us [path, pathItem] pairs
    // Example: ['/users', { get: {...}, post: {...} }]
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      // Array of HTTP methods we support
      // Type is a literal union - must be exactly one of these strings
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
  public getSchemas(): Map<string, Schema> {
    return this.schemas;
  }
}

