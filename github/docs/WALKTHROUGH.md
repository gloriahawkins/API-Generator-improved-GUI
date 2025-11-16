# Senior-level walkthrough

Use this checklist when walking someone through the generator. Each section maps to concrete files so you can point at the code immediately.

## 1. Start with the spec
- File: [`petstore-api.json`](../petstore-api.json)
- Highlights: 4 endpoints, enum query params, typed request body, success + error responses.
- Talking point: emphasize the variety (path params, query enums, POST body) so the reviewer sees why the generator needs to be robust.

## 2. Run the CLI
- Command: `npm run generate petstore-api.json tmp/petstore-client.ts`
- File: [`src/cli.ts`](../src/cli.ts)
- Talking points:
  - Shows progress logs and feature bullets.
  - Emits both the client and an example usage file.
  - Fails fast with usage instructions if required args are missing.

## 3. Explain the pipeline
- Share the ASCII diagram in [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
- Point out how `Endpoint` objects (parser output) become per-method emitters in `TypeScriptClientGenerator`.
- Remind the reviewer that the parser also resolves `$ref`s before generation, ensuring type reuse.

## 4. Show the generated ergonomics
- File: [`docs/snippets/petstore-client-snippet.ts`](./snippets/petstore-client-snippet.ts)
- Use this snippet to call out:
  - `ApiResult` discriminated union forcing `_tag` checks.
  - `setApiKey`/`setBearerToken` setters and constructor config.
  - Request/response interceptors plus retry tuning (`setRetryConfig`).
  - The internal fetch wrapper that runs interceptors, auth headers, and retries.

## 5. Demonstrate discriminated-union handling
- File: [`src/example-generator.ts`](../src/example-generator.ts)
- Talking points:
  - The example code inspects `result._tag` before accessing `data`.
  - This is the same pattern consumers will use, so reviewers can see end-user DX immediately.

## 6. Close with verification
- Command: `npm run test:e2e`
- File: [`tests/e2e/run-generator.test.js`](../tests/e2e/run-generator.test.js)
- Talking points:
  - Proves the CLI works against a real spec.
  - Guards the key ergonomic hooks so regressions are caught automatically.

Keep this walkthrough doc nearby during your meeting—the reviewer gets a guided tour without forcing you to remember every path off the top of your head.
