/**
 * TypeScript Type Definitions for OpenAPI 3.0 Specification
 * 
 * These interfaces represent the structure of an OpenAPI specification.
 * They provide type safety when parsing OpenAPI JSON files.
 * 
 * OpenAPI (formerly Swagger) is a standard for describing REST APIs.
 * This file defines TypeScript types that match the OpenAPI JSON structure.
 */

/**
 * Root OpenAPI specification interface
 * 
 * This represents the entire OpenAPI document structure.
 * All OpenAPI specs must have openapi version, info, and paths.
 * 
 * Example OpenAPI structure:
 * {
 *   openapi: "3.0.0",
 *   info: { title: "My API", version: "1.0.0" },
 *   paths: { "/users": { get: {...} } }
 * }
 */
export interface OpenAPISpec {
  // OpenAPI version (e.g., "3.0.0")
  openapi: string;
  
  // API metadata
  info: {
    title: string;        // API name
    version: string;      // API version
    description?: string; // Optional description
  };
  
  // Server URLs where the API is hosted
  // Optional - if not provided, uses default
  servers?: Array<{
    url: string;           // Base URL (e.g., "https://api.example.com")
    description?: string;  // Optional description
  }>;
  
  // All API endpoints organized by path
  // Record<K, V> means object with keys of type K and values of type V
  // Key: path (e.g., "/users/{id}")
  // Value: PathItem (contains HTTP methods for that path)
  paths: Record<string, PathItem>;
  
  // Reusable components (schemas, parameters, etc.)
  // Optional - many specs don't define components
  components?: {
    // Type definitions that can be referenced with $ref
    schemas?: Record<string, Schema>;
    // Reusable parameters
    parameters?: Record<string, Parameter>;
  };
}

/**
 * Represents the set of HTTP operations allowed on a single path entry.
 * Each optional property corresponds to the HTTP verbs we currently support.
 */
export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

/**
 * A single HTTP operation pulled straight from the OpenAPI document. This is
 * the authoritative source of request/response metadata that the parser lifts
 * into higher-level Endpoint objects.
 */
export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  tags?: string[];
}

/**
 * Normalized representation of an operation that the generator consumes. The
 * parser flattens shared parameters and ensures every endpoint has an
 * `operationId`, making code generation dramatically simpler.
 */
export interface Endpoint {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  operationId: string;
  summary?: string;
  description?: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  tags?: string[];
}

/**
 * Definition of a parameter that may appear in the path, query string, headers,
 * or cookies. We keep the schema optional because OpenAPI allows references or
 * primitive-only descriptions, and the generator accounts for both cases.
 */
export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Schema;
  style?: string;
}

/**
 * Metadata about the request body payload. Most APIs we target rely on
 * `application/json`, but the union structure allows for other content types in
 * the future.
 */
export interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
}

/**
 * Minimal representation of an HTTP response declaration from OpenAPI. We only
 * need the textual description and the schema map for type generation.
 */
export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

/**
 * Schema type - represents any OpenAPI schema definition
 * 
 * This is a discriminated union type - it can be one of many different shapes.
 * The 'type' property (when present) acts as a discriminator to help TypeScript
 * narrow the type.
 * 
 * OpenAPI schemas can be:
 * - Primitive types (string, number, boolean)
 * - Arrays (with item schema)
 * - Objects (with properties)
 * - References to other schemas ($ref)
 * - Combinations (oneOf, allOf, anyOf)
 * 
 * This union type represents all possible schema shapes.
 * 
 * Example schemas:
 * - { type: 'string' } - simple string
 * - { type: 'string', enum: ['active', 'inactive'] } - string with allowed values
 * - { type: 'array', items: { type: 'string' } } - array of strings
 * - { type: 'object', properties: { name: { type: 'string' } } } - object with name property
 * - { $ref: '#/components/schemas/User' } - reference to User schema
 */
export type Schema =
  // String type - can have enum (allowed values), format, or default
  | { type: 'string'; enum?: string[]; format?: string; default?: string }
  
  // Number type - OpenAPI distinguishes number (float) and integer, but we treat both as number
  | { type: 'number' | 'integer'; format?: string; default?: number }
  
  // Boolean type
  | { type: 'boolean'; default?: boolean }
  
  // Array type - items is the schema for array elements (recursive!)
  | { type: 'array'; items: Schema }
  
  // Object type - most complex
  // properties: object mapping property names to their schemas
  // required: array of property names that are required
  // additionalProperties: whether to allow extra properties
  | { type: 'object'; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean | Schema }
  
  // Reference to another schema - $ref contains the path
  | { $ref: string }
  
  // oneOf: value must match exactly ONE of the schemas (union type)
  | { oneOf: Schema[] }
  
  // allOf: value must match ALL schemas (intersection type - combines properties)
  | { allOf: Schema[] }
  
  // anyOf: value can match ANY of the schemas (union type, like oneOf)
  | { anyOf: Schema[] };

export interface GeneratedClient {
  className: string;
  baseUrl: string;
  endpoints: Endpoint[];
  types: Map<string, string>;
}

