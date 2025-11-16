import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { generateClientArtifacts } from '../../src/index.js';

function runCliSmokeTest() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'openapi-client-'));
  const outputFile = join(tmpDir, 'petstore-client.ts');

  const result = spawnSync('npm', ['run', 'generate', '--', 'petstore-api.json', outputFile], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Generator CLI exited with a non-zero status code.');
  }

  if (!existsSync(outputFile)) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Expected generated client to exist, but file was missing.');
  }

  const contents = readFileSync(outputFile, 'utf8');
  const expectations = [
    { snippet: 'class PetStoreAPIClient', description: 'client class generated' },
    { snippet: 'addRequestInterceptor', description: 'request interceptor hook exists' },
    { snippet: 'setRetryConfig', description: 'retry configuration hook exists' },
    { snippet: 'export type ApiResult', description: 'discriminated union types exported' },
  ];

  for (const { snippet, description } of expectations) {
    if (!contents.includes(snippet)) {
      rmSync(tmpDir, { recursive: true, force: true });
      throw new Error(`Generated client is missing "${description}" (expected snippet: ${snippet}).`);
    }
  }

  rmSync(tmpDir, { recursive: true, force: true });
}

function runProgrammaticApiTest() {
  const artifacts = generateClientArtifacts('petstore-api.json');

  assert.ok(artifacts.client.includes(`class ${artifacts.className}`), 'client code should include the class definition');
  assert.ok(artifacts.example && artifacts.example.includes(`new ${artifacts.className}`), 'example should instantiate the client');
  assert.ok(artifacts.endpoints.length > 0, 'parser should expose at least one endpoint');
  assert.ok(artifacts.baseUrl.length > 0, 'base URL should be resolved from the spec');
}

function main() {
  runCliSmokeTest();
  runProgrammaticApiTest();
  console.log('E2E smoke + programmatic API tests passed.');
}

try {
  main();
} catch (error) {
  console.error('E2E suite failed.', error);
  process.exit(1);
}
