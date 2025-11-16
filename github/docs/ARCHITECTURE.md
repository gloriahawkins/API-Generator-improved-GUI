# Architecture overview

This document is designed to help reviewers (and future-you) understand the moving parts of the OpenAPI TypeScript Client Generator. Start here before diving into the source files.

## System flow

```
OpenAPI JSON ──▶ CLI (`src/cli.ts`) ──▶ Parser (`src/parser.ts`) ──▶ Generator (`src/generator.ts`)
                                         │                                   │
                                         │                                   ├──▶ Example generator (`src/example-generator.ts`)
                                         └──▶ `Endpoint[]` + schema map      └──▶ Generated client + exports
```

1. **CLI** reads a spec path and (optional) output path, initializes the parser and generator, then writes the generated client plus an example usage file.
2. **OpenAPIParser** normalizes the spec: it caches `components.schemas` in a `Map`, walks every `paths.{path}.{method}` entry, and emits a strongly typed `Endpoint` object per operation (containing params, request body, responses, and metadata like `operationId`).
3. **TypeScriptClientGenerator** consumes the parser, synthesizes discriminated-union helper types, converts schemas to TS types, builds the runtime client class (interceptors, retries, auth), and exports everything from a single module.
4. **ExampleGenerator** reuses parser metadata and the class name from the generator to produce a runnable usage sample that demonstrates interceptors, auth, retries, and discriminated unions.

## Key data structures

| Structure | Defined in | Purpose |
|-----------|------------|---------|
| `OpenAPISpec` / `Schema` / `RequestBody` | `src/types.ts` | Describe the OpenAPI 3.0 schema tree in TypeScript so the parser and generator can talk in a type-safe way. |
| `Endpoint` | `src/types.ts` | Captures everything needed to emit a single method: HTTP method, path template, params (path/query/header), request body schema, and the success/errored responses. |
| Schema cache (`Map<string, Schema>`) | `src/parser.ts` | Allows `$ref` resolution when generating TypeScript types. |

## Responsibilities per module

### `src/cli.ts`
- Validates CLI arguments (`npm run generate <spec> [output.ts]`).
- Reads/parses the JSON spec from disk.
- Instantiates `OpenAPIParser` and `TypeScriptClientGenerator`.
- Writes the generated client and example files, logging high-level progress and features.

### `src/parser.ts`
- Loads and stores component schemas in a `Map` for fast lookup.
- Generates fallback `operationId`s when a spec omits them (`<METHOD><PascalCasePath>`).
- Emits `Endpoint` objects with resolved parameter and request body shapes.
- Provides helpers like `getBaseUrl()` used by the generator when emitting the client constructor.

### `src/generator.ts`
- Produces the header block (documentation, `ApiResult` types, interceptor types).
- Converts schemas into inline TypeScript type aliases or interfaces.
- Builds the client class, wiring in:
  - Authentication setters (`setApiKey`, `setBearerToken`).
  - Request/response interceptor registries and execution order.
  - Retry logic with exponential backoff inside `internalFetch`.
  - Per-endpoint methods that serialize path/query params and wrap results in `ApiResult`.

### `src/example-generator.ts`
- Creates a sample file showing how to instantiate the generated client, configure interceptors/auth, and consume the discriminated-union results from the first few endpoints.

### Tests (`tests/e2e/run-generator.test.js`)
- Shells out to the CLI with `petstore-api.json`.
- Asserts the generated file exists and contains the critical ergonomic hooks (interceptors, retry config, discriminated unions).
- Cleans up temporary directories so the repository stays tidy.

Keep this document handy when you need to walk someone through the project—each bullet points at the exact file/function that implements the behavior.
