#!/usr/bin/env node

import { writeFileSync } from 'fs';
import * as readline from 'readline';
import { generateClientArtifacts } from './index.js';

/**
 * Entry-point for the `npm run generate` command.
 *
 * The CLI now supports both interactive mode (when no args provided) and
 * non-interactive mode (when args are provided for CI/automation).
 *
 * Interactive mode:
 * 1. Prompts for API key (optional)
 * 2. Prompts for OpenAPI spec file path
 * 3. Prompts for output file path (with default)
 * 4. Generates client with API key included in example if provided
 */

/**
 * Prompts the user for input using readline
 * 
 * TypeScript Concepts:
 * - Return type annotation: Promise<string> - explicitly declares this function returns a Promise that resolves to a string
 * - Generic type: Promise<T> - Promise is a generic type where T is the resolved value type
 * - Arrow function: (answer) => { ... } - arrow function syntax, answer parameter is inferred as string from readline types
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}


/**
 * Check if a string is a URL
 * 
 * TypeScript Concepts:
 * - Return type annotation: boolean - explicitly declares return type
 * - Parameter type annotation: str: string - parameter must be a string
 * - Try-catch without catch parameter: catch { } - TypeScript allows omitting the error parameter if unused
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
 * Generate a smart filename from API URL or input
 * 
 * TypeScript Concepts:
 * - Optional parameter: apiName?: string - the ? makes this parameter optional
 * - Optional parameters must come after required parameters
 * - Return type annotation: string - function must return a string
 */
function generateOutputFileName(input: string, apiName?: string): string {
  if (isUrl(input)) {
    try {
      const url = new URL(input);
      const hostParts = url.hostname.split('.');
      const domain = hostParts.length > 1 ? hostParts[hostParts.length - 2] : 'api';
      return `${domain}-client.ts`;
    } catch {
      return 'api-client.ts';
    }
  } else if (apiName) {
    // Use API name from spec if available
    const cleanName = apiName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${cleanName}-client.ts`;
  } else {
    // Extract name from file path
    const fileName = input.split(/[/\\]/).pop() || 'api';
    return fileName.replace('.json', '-client.ts');
  }
}

/**
 * Main interactive flow - SIMPLIFIED: Just URL and API key
 * 
 * TypeScript Concepts:
 * - Async function: async function - allows using await inside
 * - Await: await prompt(...) - waits for Promise to resolve before continuing
 * - Logical OR with undefined: apiKey || undefined - converts empty string to undefined
 */
async function interactiveMode() {
  console.log('OpenAPI TypeScript Client Generator\n');
  
  // Just ask for the URL/endpoint
  const input = await prompt('Enter your API endpoint URL (or OpenAPI JSON file): ');
  
  if (!input || input.trim().length === 0) {
    console.error('Error: Please provide an API endpoint URL or file path.');
    process.exit(1);
  }
  
  // Ask for API key
  const apiKey = await prompt('Enter your API key (press Enter to skip): ');
  
  // Auto-generate output filename - no prompt needed!
  const outputFile = generateOutputFileName(input);
  
  // Generate the client
  await generateAndWrite(input, outputFile, apiKey || undefined);
}

/**
 * Non-interactive mode (for CI/automation)
 * 
 * TypeScript Concepts:
 * - Array type: string[] - parameter is an array of strings
 * - Array access: args[0], args[1] - accessing array elements (TypeScript knows these are strings or undefined)
 * - Default value: args[1] || 'generated-client.ts' - uses default if undefined
 */
function nonInteractiveMode(args: string[]) {
  const inputFile = args[0];
  const outputFile = args[1] || 'generated-client.ts';
  const apiKey = args[2]; // Optional third argument for API key
  
  generateAndWrite(inputFile, outputFile, apiKey);
}

/**
 * Generate client and write to disk
 * 
 * TypeScript Concepts:
 * - Optional parameter: apiKey?: string - parameter is optional
 * - Destructuring assignment: const { client, example, ... } = ... - extracts properties from object
 * - Type inference: TypeScript infers types of destructured variables from return type
 * - Optional chaining: if (example) - checks if property exists before using
 * - Type narrowing: TypeScript knows example is defined inside the if block
 */
async function generateAndWrite(
  input: string,
  outputFile: string,
  apiKey?: string
) {
  try {
    const isInputUrl = isUrl(input);
    if (isInputUrl) {
      console.log(`\nGenerating client from API URL...`);
    } else {
      console.log(`\nReading OpenAPI spec...`);
    }
    
    const { client, example, endpoints, className, baseUrl } = generateClientArtifacts(input, {
      includeExample: true,
      apiKey: apiKey,
      outputFileName: outputFile, // Pass output file name for correct imports
    });

    console.log('Writing generated client to disk...');
    writeFileSync(outputFile, client, 'utf-8');

    // Keep the example file co-located by mirroring the primary file name.
    const exampleFile = outputFile.replace('.ts', '-example.ts');
    if (example) {
      console.log(`Generating example usage file: ${exampleFile}`);
      writeFileSync(exampleFile, example, 'utf-8');
    }

    console.log(`\nDone! Generated ${endpoints.length} endpoint(s).`);
    console.log(`\nFiles created:`);
    console.log(`   ${outputFile}`);
    if (example) {
      console.log(`   ${exampleFile}`);
    }
    
    if (example) {
      console.log(`\nQuick start:`);
      const importPath = outputFile.replace('.ts', '');
      console.log(`   import { ${className} } from './${importPath}';`);
      console.log(`   const client = new ${className}('${baseUrl}');`);
      if (apiKey) {
        console.log(`   client.setApiKey('your-api-key');`);
      }
      console.log(`\n   Or run the example: tsx ${exampleFile}`);
    }
  } catch (error) {
    console.error('Error generating client:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 * 
 * TypeScript Concepts:
 * - Array method: process.argv.slice(2) - returns array of strings
 * - Promise handling: .catch() - handles rejected promises
 * - Arrow function: (error) => { ... } - error parameter type is inferred as Error or unknown
 */
function main() {
  // Drop the node + script entries and only keep user-provided arguments.
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode - prompt for all inputs
    interactiveMode().catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
  } else {
    // Non-interactive mode - use provided arguments
    // Usage: npm run generate <openapi-spec.json> [output-file.ts] [api-key]
    nonInteractiveMode(args);
  }
}

main();

