import type { Endpoint } from './types.js';
import { OpenAPIParser } from './parser.js';

/**
 * Produces the `*-example.ts` companion file that mirrors the generated client API.
 *
 * This is intentionally high-level sample code, but the added comments explain
 * why we emit certain scaffolding:
 * - Showing interceptors/auth/retry mirrors the runtime hooks present in the client.
 * - Sampling only the first few endpoints keeps the file approachable while still
 *   teaching the ergonomics.
 */
export class ExampleGenerator {
  private parser: OpenAPIParser;
  private className: string;

  /**
   * @param parser Reuse the already-instantiated parser so we operate on the
   *               exact same endpoint list as the main generator.
   * @param className The class emitted by the generator—used for imports and
   *                  instantiation to keep filenames/types in sync.
   */
  constructor(parser: OpenAPIParser, className: string) {
    this.parser = parser;
    this.className = className;
  }

  /**
   * Detects if an API key parameter exists in query parameters
   * Supports common API key naming patterns
   */
  private detectApiKeyQueryParam(endpoints: Endpoint[]): { found: boolean; paramName: string | null } {
    // Common API key parameter names (case-insensitive)
    // Supports: key, api_key, apikey, api-key, token, access_token, etc.
    const apiKeyPatterns = [
      'key',
      'api_key',
      'apikey',
      'api-key',
      'token',
      'access_token',
      'access-token',
      'accesstoken',
      'auth',
      'auth_token',
      'auth-token',
      'authtoken',
      'api_token',
      'api-token',
      'apitoken',
    ];

    for (const endpoint of endpoints) {
      for (const param of endpoint.parameters) {
        if (param.in === 'query') {
          const paramNameLower = param.name.toLowerCase();
          // Check if this parameter matches any API key pattern
          if (apiKeyPatterns.some(pattern => paramNameLower === pattern)) {
            return { found: true, paramName: param.name };
          }
        }
      }
    }

    return { found: false, paramName: null };
  }

  /**
   * Build the entire example file as a single template literal string.
   *
   * Steps:
   * 1. Pull out endpoints/base URL so the example matches the spec.
   * 2. Emit boilerplate that mirrors the generated client's configuration API.
   * 3. Append per-endpoint snippets for the first three endpoints to avoid noise.
   * 
   * @param apiKey Optional API key to include in the example
   */
  public generate(apiKey?: string): string {
    const endpoints = this.parser.extractEndpoints();
    const baseUrl = this.parser.getBaseUrl();

    // Detect if API key is a query parameter (supports all common formats)
    const apiKeyQueryParam = this.detectApiKeyQueryParam(endpoints);
    const hasKeyQueryParam = apiKeyQueryParam.found;

    // Build the client initialization
    let apiKeyConfig = '';
    
    if (hasKeyQueryParam) {
      // API key is a query parameter - use provided key or environment variable
      if (apiKey) {
        // If API key was provided, use it directly - no env var needed!
        apiKeyConfig = `// API key provided during generation - ready to use!`;
      } else {
        // Fall back to environment variable if no key provided
        apiKeyConfig = `// Get API key from environment variable or replace with your key below`;
      }
    } else {
      // API key is a header - use client's apiKey property
      if (apiKey) {
        apiKeyConfig = `  apiKey: '${apiKey}',`;
      } else {
        apiKeyConfig = `  // apiKey: process.env.API_KEY || 'your-api-key',`;
      }
    }

    let code = `/**
 * Example usage of the generated ${this.className}
 * 
 * This file demonstrates:
 * - Type-safe API calls with autocomplete
 * - Error handling with discriminated unions
 * - Request/response interceptors
 * - Authentication
 * - Retry configuration
 * 
 * 🚀 READY TO RUN! Just execute:
 *   npx tsx ${this.getClientFileName().replace('.js', '-example.ts')}
 * 
 * ${apiKey ? '✅ API key is already included - no setup needed!' : '⚠️  Replace YOUR_API_KEY_HERE with your actual API key, or set $env:API_KEY="your-key"'}
 */

import { ${this.className} } from './${this.getClientFileName()}';

${hasKeyQueryParam ? `// API key for this API (uses '${apiKeyQueryParam.paramName}' as a query parameter)
${apiKey ? `const API_KEY = '${apiKey}'; // ✅ API key included - ready to run!` : `const API_KEY = process.env.API_KEY || 'YOUR_API_KEY_HERE'; // ⚠️ Replace with your actual API key`}

` : ''}// Initialize the client
const client = new ${this.className}({
  baseUrl: '${baseUrl}',
${hasKeyQueryParam ? '' : `  ${apiKeyConfig}`}
  // bearerToken: process.env.BEARER_TOKEN || 'your-token',
  maxRetries: 3,
});

// Example: Add request interceptor for logging
client.addRequestInterceptor((request) => {
  console.log('Making request:', request);
  return request;
});

// Example: Add response interceptor for data transformation
client.addResponseInterceptor((response, data) => {
  console.log('Received response:', response.status, data);
  return data;
});

async function examples() {
  try {
`;

    // Generate examples for first 3 endpoints
    const exampleEndpoints = endpoints.slice(0, 3);
    for (const endpoint of exampleEndpoints) {
      code += this.generateEndpointExample(endpoint);
    }

    code += `  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples
examples().catch(console.error);
`;

    return code;
  }

  /**
   * Emit a heavily commented usage example for a single endpoint.
   *
   * Rather than attempting to be 100% accurate about every edge case, the
   * example intentionally demonstrates the core ergonomics reviewers care about:
   * path params, query params, request bodies, and discriminated-union handling.
   */
  private generateEndpointExample(endpoint: Endpoint): string {
    const methodName = this.sanitizeMethodName(endpoint.operationId);
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');
    const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
    const hasBody = !!endpoint.requestBody;
    
    // Check if this endpoint has an API key as a query parameter
    // Common patterns: key, api_key, token, access_token, etc.
    const apiKeyPatterns = ['key', 'api_key', 'apikey', 'api-key', 'token', 'access_token', 'access-token', 'accesstoken', 'auth', 'auth_token', 'auth-token', 'authtoken', 'api_token', 'api-token', 'apitoken'];
    const apiKeyParam = queryParams.find(p => 
      apiKeyPatterns.some(pattern => p.name.toLowerCase() === pattern)
    );

    let example = `\n    // Example: ${endpoint.summary || endpoint.operationId}\n`;
    example += `    const result = await client.${methodName}(`;

    const params: string[] = [];
    // Helper to check if schema has a type property
    const hasType = (schema?: any): schema is { type: string; [key: string]: any } => {
      return schema && 'type' in schema && !('$ref' in schema);
    };

    if (pathParams.length > 0) {
      const pathExample = pathParams
        .map((p) => {
          const value = hasType(p.schema) && p.schema.type === 'integer' ? '123' : '"example-value"';
          return `${p.name}: ${value}`;
        })
        .join(', ');
      params.push(`{ ${pathExample} }`);
    }
    if (queryParams.length > 0) {
      const queryExample = queryParams
        .map((p) => {
          // If this is an API key parameter, use environment variable
          if (apiKeyParam && p.name === apiKeyParam.name) {
            return `${p.name}: API_KEY`;
          }
          let value = '"value"';
          if (hasType(p.schema)) {
            if (p.schema.type === 'integer') {
              value = '10';
            } else if (p.schema.type === 'string' && 'enum' in p.schema && Array.isArray(p.schema.enum) && p.schema.enum.length > 0) {
              value = `"${p.schema.enum[0]}"`;
            }
          }
          return `${p.name}: ${value}`;
        })
        .join(', ');
      params.push(`{ ${queryExample} }`);
    }
    if (hasBody) {
      params.push('{ /* your request body */ }');
    }

    example += params.join(', ') + ');\n';
    example += `    \n`;
    example += `    // Type-safe error handling\n`;
    example += `    if (result._tag === 'Success') {\n`;
    example += `      console.log('Success:', result.data);\n`;
    example += `      // TypeScript knows result.data is the correct type!\n`;
    example += `    } else {\n`;
    example += `      console.error('API Error:', result.status, result.message);\n`;
    example += `      // TypeScript knows result.status and result.message exist\n`;
    example += `    }\n`;

    return example;
  }

  /**
   * Keep the example aligned with however the generator sanitized names.
   * This mirrors the helper inside the generator so we do not drift.
   */
  private sanitizeMethodName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  /**
   * Get the client file name - will be set by the caller
   */
  private clientFileName: string = 'generated-client.js';
  
  /**
   * Set the client file name for proper imports
   */
  public setClientFileName(fileName: string): void {
    // Convert "path/to/client.ts" to "client.js" for import
    const baseName = fileName.split('/').pop() || fileName;
    this.clientFileName = baseName.replace('.ts', '.js');
  }
  
  /**
   * Get the client file name from the class name
   */
  private getClientFileName(): string {
    return this.clientFileName;
  }
}


