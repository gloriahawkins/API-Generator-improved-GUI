/**
 * Public API entry point for the OpenAPI → TypeScript client generator.
 *
 * The CLI (`src/cli.ts`) consumes these same helpers, but exposing them here
 * means any application (CLI, build pipeline, custom scaffolder, etc.) can
 * embed the generator programmatically without reaching into private files.
 */

// TypeScript Concepts:
// - Named imports: import { ... } from '...' - imports specific exports
// - Type-only imports: import type { ... } - imports only types (removed at runtime)
// - Node.js built-in modules: 'node:fs', 'node:path' - explicit Node.js module imports

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ExampleGenerator } from './example-generator.js';
import { OpenAPIParser } from './parser.js';
import { TypeScriptClientGenerator } from './generator.js';
import type { Endpoint, OpenAPISpec } from './types.js';

/**
 * Check if a string is a URL
 * 
 * TypeScript Concepts:
 * - Return type annotation: boolean
 * - Parameter type annotation: str: string
 * - Try-catch without error parameter: catch { } - TypeScript allows this
 */
function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate an OpenAPI spec from an API endpoint URL
 */
function generateSpecFromUrl(urlString: string): OpenAPISpec {
  const url = new URL(urlString);
  
  // Extract base URL (everything before the last path segment)
  const pathParts = url.pathname.split('/').filter(p => p.length > 0);
  let baseUrl = `${url.protocol}//${url.host}`;
  let path = '/';
  
  if (pathParts.length > 0) {
    // Base URL is everything except the last path segment
    const basePath = '/' + pathParts.slice(0, -1).join('/');
    baseUrl += basePath;
    // The endpoint path is the last segment
    path = '/' + pathParts[pathParts.length - 1];
  } else {
    // If no path segments, use root
    path = '/';
  }
  
  // Extract query parameters
  // TypeScript Concepts:
  // - Type annotation: any[] - array of any type (used when type is unknown at compile time)
  // - Note: 'any' disables type checking - use sparingly, but needed here for dynamic OpenAPI spec generation
  const parameters: any[] = [];
  url.searchParams.forEach((value, key) => {
    // Determine parameter type based on value
    let paramType = 'string';
    if (value === 'true' || value === 'false') {
      paramType = 'boolean';
    } else if (!isNaN(Number(value)) && value !== '') {
      paramType = Number.isInteger(Number(value)) ? 'integer' : 'number';
    }
    
    // Check if it's a placeholder like [api_token], [x], [y]
    const isPlaceholder = value.startsWith('[') && value.endsWith(']');
    const isRequired = isPlaceholder || key === 'key' || key === 'layer' || key === 'x' || key === 'y';
    
    parameters.push({
      name: key,
      in: 'query',
      required: isRequired,
      schema: {
        type: paramType,
        ...(paramType === 'integer' && !isPlaceholder ? { default: parseInt(value) } : {}),
        ...(paramType === 'number' && !isPlaceholder ? { default: parseFloat(value) } : {}),
        ...(paramType === 'boolean' && !isPlaceholder ? { default: value === 'true' } : {})
      },
      description: `Query parameter: ${key}`
    });
  });

  // Extract API name from hostname
  const hostParts = url.hostname.split('.');
  const apiName = hostParts.length > 1 ? hostParts[hostParts.length - 2] : 'API';
  const capitalizedName = apiName.charAt(0).toUpperCase() + apiName.slice(1);

  return {
    openapi: '3.0.0',
    info: {
      title: `${capitalizedName} API`,
      version: '1.0.0',
      description: `Auto-generated API client for ${url.hostname}`
    },
    servers: [
      {
        url: baseUrl
      }
    ],
    paths: {
      [path]: {
        get: {
          operationId: path.replace(/[^a-zA-Z0-9]/g, '') || 'getData',
          summary: `GET ${path}`,
          description: `Query endpoint at ${path}`,
          parameters,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: true
                  }
                }
              }
            },
            '400': {
              description: 'Bad request'
            },
            '401': {
              description: 'Unauthorized'
            },
            '500': {
              description: 'Server error'
            }
          }
        }
      }
    }
  };
}

/**
 * Load a spec from disk if a string path is provided. Passing a parsed spec
 * object skips disk I/O entirely, which is handy when specs are already in
 * memory (e.g., fetched over HTTP or composed dynamically).
 * 
 * Now also supports URLs - if a URL is provided, it will generate an OpenAPI
 * spec from the URL pattern.
 */
function normalizeSpec(input: OpenAPISpec | string): OpenAPISpec {
  if (typeof input === 'string') {
    // Check if it's a URL
    if (isUrl(input)) {
      console.log(`Detected URL, generating OpenAPI spec from endpoint pattern...`);
      return generateSpecFromUrl(input);
    }
    
    // Otherwise, treat as file path
    const absolutePath = resolve(process.cwd(), input);
    if (!existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    const raw = readFileSync(absolutePath, 'utf-8');
    // TypeScript Concepts:
    // - Type assertion: as OpenAPISpec - tells TypeScript to treat the result as OpenAPISpec type
    // - Type assertions bypass type checking - use when you know the type better than TypeScript
    return JSON.parse(raw) as OpenAPISpec;
  }

  return input;
}

// TypeScript Concepts:
// - Interface: defines the shape of an object
// - Optional properties: property?: type - property may be undefined
// - JSDoc comments: /** */ - documentation that appears in IDE tooltips

export interface GenerateClientArtifactsOptions {
  /**
   * Emit the usage example alongside the client code. Defaults to true so the
   * runtime ergonomics are always demonstrated unless explicitly disabled.
   */
  includeExample?: boolean;
  /**
   * Optional API key to include in the generated example file.
   * If provided, the example will show how to use the API key with the client.
   */
  apiKey?: string;
  /**
   * Output file name for the client (used to generate correct import paths in example).
   */
  outputFileName?: string;
}

// TypeScript Concepts:
// - Interface with required and optional properties
// - Array type: Endpoint[] - array of Endpoint objects
// - Optional property: example?: string - may be undefined

export interface GeneratedClientArtifacts {
  /** Name of the generated client class (e.g., `PetStoreAPIClient`). */
  className: string;
  /** The full TypeScript client source code. */
  client: string;
  /** Optional example file contents (only omitted when includeExample === false). */
  example?: string;
  /** Normalized endpoints that back the generated methods. */
  endpoints: Endpoint[];
  /** Base URL pulled from the OpenAPI `servers` array. */
  baseUrl: string;
}

/**
 * Generate client + example source code from either a parsed spec object or a
 * path to an OpenAPI JSON file. The helper is synchronous to mirror the CLI and
 * to keep usage simple inside build scripts.
 * 
 * TypeScript Concepts:
 * - Union type parameter: specInput: OpenAPISpec | string - parameter can be either type
 * - Default parameter value: options = {} - if not provided, uses empty object
 * - Return type annotation: : GeneratedClientArtifacts - function must return this type
 * - Generic types: OpenAPISpec, GeneratedClientArtifacts - custom types defined in types.ts
 */
export function generateClientArtifacts(
  specInput: OpenAPISpec | string,
  options: GenerateClientArtifactsOptions = {},
): GeneratedClientArtifacts {
  const spec = normalizeSpec(specInput);
  const parser = new OpenAPIParser(spec);
  const generator = new TypeScriptClientGenerator(parser);
  const client = generator.generate();
  const className = generator.generateClassName();
  const endpoints = parser.extractEndpoints();
  const baseUrl = parser.getBaseUrl();

  // TypeScript Concepts:
  // - Union type variable: string | undefined - can be either string or undefined
  // - Explicit initialization: let example: string | undefined; - starts as undefined
  let example: string | undefined;
  if (options.includeExample !== false) {
    const exampleGenerator = new ExampleGenerator(parser, className);
    // Set the client file name for correct imports
    if (options.outputFileName) {
      const clientFileName = options.outputFileName.split(/[/\\]/).pop() || options.outputFileName;
      exampleGenerator.setClientFileName(clientFileName);
    }
    example = exampleGenerator.generate(options.apiKey);
  }

  return {
    className,
    client,
    example,
    endpoints,
    baseUrl,
  };
}

// Re-export the building blocks so other applications can compose their own
// pipelines without importing from deep internal paths.
export { ExampleGenerator } from './example-generator.js';
export { OpenAPIParser } from './parser.js';
export { TypeScriptClientGenerator } from './generator.js';
export * from './types.js';
