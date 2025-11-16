/**
 * Example usage of the generated GovtAPIClient
 * 
 * This file demonstrates:
 * - Type-safe API calls with autocomplete
 * - Error handling with discriminated unions
 * - Request/response interceptors
 * - Authentication
 * - Retry configuration
 * 
 * To run this example:
 *   1. Set your API key: $env:API_KEY="your-key" (PowerShell) or export API_KEY="your-key" (Linux/Mac)
 *   2. Run: tsx govtapiclient-example.ts
 */

import { GovtAPIClient } from './generated-client.js';

// Get API key from environment variable
// This API uses 'key' as a query parameter
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('❌ Error: API_KEY environment variable is required!');
  console.error('   Set it with: $env:API_KEY="your-key" (PowerShell) or export API_KEY="your-key" (Linux/Mac)');
  process.exit(1);
}

// Initialize the client
const client = new GovtAPIClient({
  baseUrl: 'https://data.linz.govt.nz/services/query/v1',

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

    // Example: GET /vector.json
    const result = await client.vectorjson({ key: API_KEY, layer: 10, x: "value", y: "value", max_results: 10, radius: 10, geometry: "value", with_field_names: "value" });
    
    // Type-safe error handling
    if (result._tag === 'Success') {
      console.log('Success:', result.data);
      // TypeScript knows result.data is the correct type!
    } else {
      console.error('API Error:', result.status, result.message);
      // TypeScript knows result.status and result.message exist
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples
examples().catch(console.error);
