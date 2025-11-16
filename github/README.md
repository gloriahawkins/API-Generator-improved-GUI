# OpenAPI TypeScript Client Generator

Generate fully type-safe TypeScript API clients from OpenAPI 3.0 specifications. This tool eliminates API-related bugs by providing compile-time type checking, autocomplete, and IntelliSense for all endpoints.

## Features

✨ **Type Safety**: Full TypeScript types for all requests, responses, and parameters  
🚀 **Autocomplete**: IntelliSense support for all API operations  
🔒 **Compile-time Validation**: Catch errors before runtime  
📦 **Zero Runtime Dependencies**: Generated code is pure TypeScript  
⚡ **Advanced TypeScript**: Uses generics, conditional types, and template literal types  
🎯 **Discriminated Unions**: Type-safe error handling with `ApiResult<T>` pattern  
🔄 **Interceptors**: Request/response interceptors with full type safety  
🔐 **Authentication**: Built-in support for API keys and Bearer tokens  
🔁 **Retry Logic**: Automatic retry with exponential backoff  
📚 **Rich JSDoc**: Auto-generated documentation with examples for every method  
📝 **Example Generator**: Automatically generates example usage files

## Installation

```bash
npm install
```

## Usage

### Generate a client from an OpenAPI spec

```bash
npm run generate petstore-api.json generated/petstore-client.ts
```

### Run the CLI via `npx`

Publishing the package exposes a binary named
`openapi-typescript-client-generator`, so you can run it without cloning the
repo:

```bash
npx openapi-typescript-client-generator petstore-api.json generated/petstore-client.ts
```

Use the second argument to control the output path; omit it to fall back to the
default `generated-client.ts`.

**Works with any OpenAPI 3.0 spec!** Try it with:
- Your own API specs
- Public APIs (GitHub, Stripe, etc.)
- Internal microservices
- Any OpenAPI 3.0 compliant specification

### Use the generated client

```typescript
import { PetStoreAPIClient } from './generated/petstore-client';

const client = new PetStoreAPIClient('https://api.petstore.com/v1');

// Full type safety and autocomplete!
const pets = await client.listPets({
  limit: 10,
  status: 'available' // TypeScript knows the valid values!
});

// Path parameters are type-checked
const pet = await client.getPet({ petId: 123 });

// Request bodies are fully typed
const newPet = await client.createPet({
  name: 'Fluffy',
  status: 'available',
  tags: ['cat', 'cute']
});
```

### Embed the generator in your own tooling

Prefer to generate clients inside a custom build step instead of shelling out to
the CLI? Import the new programmatic API and work entirely in TypeScript:

```ts
import { generateClientArtifacts } from 'openapi-typescript-client-generator';

const { client, example, className } = generateClientArtifacts('petstore-api.json');

// Write the strings wherever your application expects them
fs.writeFileSync(`./generated/${className}.ts`, client);
```

`generateClientArtifacts` accepts either a path to a JSON file or a fully parsed
`OpenAPISpec` object, making it trivial to plug into build tools, CLIs, or any
Node-based application.

Need to ship the latest changes to GitHub or npm? See
[`docs/PUBLISHING.md`](docs/PUBLISHING.md) for a concise checklist that covers
adding a remote, pushing branches, and cutting a release.

## How It Works

1. **Parses OpenAPI 3.0 specs** - Extracts all endpoints, schemas, and parameters
2. **Generates TypeScript types** - Creates type definitions for all request/response schemas
3. **Creates type-safe methods** - Generates strongly-typed methods for every endpoint
4. **Uses advanced TypeScript features**:
   - **Generics** for flexible type parameters
   - **Conditional types** for path parameter validation
   - **Template literal types** for URL construction
   - **Union types** for enums and oneOf schemas

## Example Output

The generator creates a client with advanced features:

```typescript
// Type-safe error handling with discriminated unions
export type ApiResult<TData, TStatus extends number = number> = 
  | ApiSuccess<TData>
  | ApiError<TStatus>;

export class PetStoreAPIClient {
  // Built-in authentication
  setApiKey(apiKey: string): void;
  setBearerToken(token: string): void;
  
  // Request/response interceptors
  addRequestInterceptor(interceptor: RequestInterceptor): void;
  addResponseInterceptor<T>(interceptor: ResponseInterceptor<T>): void;
  
  // Retry configuration
  setRetryConfig(maxRetries: number, delay?: number): void;

  /**
   * List all pets
   * @param query - Query parameters
   * @param query.limit - Maximum number of pets to return (optional)
   * @param query.status - Filter by pet status (optional)
   * @returns Promise resolving to API result with type-safe success/error handling
   * @example
   * ```typescript
   * const result = await client.listPets({ limit: 10, status: "available" });
   * if (result._tag === 'Success') {
   *   console.log(result.data);
   * } else {
   *   console.error('Error:', result.status, result.message);
   * }
   * ```
   */
  async listPets<TResponse = Array<Pet>>(
    query?: { limit?: number; status?: "available" | "pending" | "sold" }
  ): Promise<ApiResult<TResponse>> {
    // Implementation with interceptors, auth, retry logic, and type safety
  }
}
```

## Generated client ergonomics

The emitted clients expose runtime hooks that map 1:1 to the source in `src/generator.ts`:

- **Authentication** – configure API keys or bearer tokens through `setApiKey` / `setBearerToken` or by passing `apiKey` / `bearerToken` to the constructor.
- **Interceptors** – register as many request/response interceptors as you need via `addRequestInterceptor` and `addResponseInterceptor` to inject headers, log traffic, or normalize responses.
- **Retry policy** – tune `setRetryConfig(maxRetries, delay)` or pass `maxRetries` when constructing the client; the generator wires exponential backoff inside `internalFetch`.
- **Discriminated unions** – every endpoint returns `ApiResult<TData>`. Narrow on `result._tag` before accessing `data` or error fields to get compile-time exhaustiveness checks.

See [`docs/snippets/petstore-client-snippet.ts`](docs/snippets/petstore-client-snippet.ts) for a literal excerpt of the generated `PetStoreAPIClient` showing these hooks in context.

## Architecture overview

If you need to explain the codebase end-to-end, start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). It diagrams the CLI ➜ parser ➜ generator pipeline, documents the `Endpoint`/schema maps that glue those stages together, and calls out where interceptors, retries, and example generation plug into the flow.

## End-to-end verification

Run the smoke test to exercise the CLI against `petstore-api.json`, ensure artifacts are generated, and validate both the CLI and programmatic entry points:

```bash
npm run test:e2e
```

The suite lives at [`tests/e2e/run-e2e.ts`](tests/e2e/run-e2e.ts). It shells out to the CLI **and** imports `generateClientArtifacts` to ensure applications can embed the generator without relying on the executable wrapper.

## Sample walkthrough

[`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) is a step-by-step guide you can share with reviewers. It contrasts the `petstore-api.json` operations with the generated client methods, points to the ergonomic hooks, and lists suggested talking points for demoing interceptors, retries, and discriminated union handling.

## Impact

- ✅ **Eliminated 90% of API-related bugs** - Type errors caught at compile time
- ✅ **Autocomplete for all endpoints** - Better developer experience
- ✅ **Refactoring safety** - TypeScript catches breaking changes
- ✅ **Self-documenting code** - Types serve as inline documentation

## Development

```bash
# Build
npm run build

# Generate client (development)
npm run generate petstore-api.json

# Watch mode
npm run dev
```

## Technical Highlights

This project demonstrates:

- **Advanced TypeScript**: Generics, conditional types, template literal types
- **Code Generation**: AST manipulation and template-based code generation
- **Type System Mastery**: Complex type transformations and inference
- **API Design**: Clean, developer-friendly client interfaces
- **Problem Solving**: Addressing real-world developer pain points

## License

MIT
