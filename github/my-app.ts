import { GovtAPIClient } from './linz-client.js';

// Create the client
const client = new GovtAPIClient({
  baseUrl: 'https://data.linz.govt.nz/services/query/v1'
});

// Make a request
async function getData() {
  const result = await client.vectorjson({
    key: 'your-api-key-here',
    layer: 50823,
    x: '174.7762',  // longitude
    y: '-41.2865'   // latitude
  });

  // Check if it succeeded
  if (result._tag === 'Success') {
    console.log('✅ Got data:', result.data);
  } else {
    console.error('❌ Error:', result.status, result.message);
  }
}

getData();