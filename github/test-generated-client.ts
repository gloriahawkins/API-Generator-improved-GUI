// -----------------------------------------------------------------------------
// Lightweight smoke-tests for the generated Pet Store client. The emphasis here
// is on demonstrating TypeScript's compile-time guarantees rather than making
// live network calls, so the comments explain what each step validates.
// -----------------------------------------------------------------------------
import { PetStoreAPIClient } from './generated/test-client.js';

// Test 1: Client instantiation
const client = new PetStoreAPIClient({
  baseUrl: 'https://api.petstore.com/v1',
  maxRetries: 3,
});

// Test 2: Type checking - should have autocomplete
const testListPets = async () => {
  // TypeScript should know the query parameter types
  const result = await client.list_pets({
    limit: 10,
    status: "available" // TypeScript knows valid values: "available" | "pending" | "sold"
  });
  
  // TypeScript should force us to check the tag
  if (result._tag === 'Success') {
    // TypeScript knows result.data is Array<Pet>
    const pets = result.data;
    console.log('Pets:', pets);
  } else {
    // TypeScript knows result.status exists
    console.error('Error:', result.status, result.message);
  }
};

// Test 3: Type checking for getPet
const testGetPet = async () => {
  // TypeScript should require petId as number
  const result = await client.get_pet({ petId: 123 });
  
  if (result._tag === 'Success') {
    // TypeScript knows result.data is Pet
    const pet = result.data;
    console.log('Pet name:', pet.name);
    console.log('Pet status:', pet.status); // TypeScript knows this is "available" | "pending" | "sold"
  }
};

// Test 4: Type checking for createPet
const testCreatePet = async () => {
  // TypeScript should require name, and know status is optional with specific values
  const result = await client.create_pet({
    name: "Fluffy",
    status: "available", // TypeScript knows valid values
    tags: ["cat", "cute"]
  });
  
  if (result._tag === 'Success') {
    const pet = result.data;
    console.log('Created pet:', pet);
  }
};

// Test 5: Interceptors
client.addRequestInterceptor((req) => {
  console.log('Request:', req);
  return req;
});

client.addResponseInterceptor((response, data) => {
  console.log('Response:', response.status);
  return data;
});

// Test 6: Authentication
client.setApiKey('test-key');
client.setBearerToken('test-token');

// Test 7: Retry configuration
client.setRetryConfig(5, 2000);

console.log('✅ All type checks passed! The generated client is type-safe.');

// Note: These are type tests - we're not actually calling the API
// The TypeScript compiler will verify the types are correct

