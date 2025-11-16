#!/usr/bin/env node

/**
 * Simple HTTP server for the GUI API Client Generator
 * User enters API key → We generate everything → Spit out code
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateClientArtifacts } from './dist/index.js';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

// Known API OpenAPI spec URLs
const API_SPECS = {
  openai: 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml',
  github: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
  stripe: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json'
};

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve GUI
  if (req.method === 'GET' && req.url === '/') {
    try {
      const html = readFileSync(join(__dirname, 'gui.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    } catch (err) {
      res.writeHead(500);
      res.end('Error loading GUI');
      return;
    }
  }

  // Generate client endpoint
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { apiKey, apiType, customUrl } = JSON.parse(body);

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API key is required' }));
          return;
        }

        let specInput;

        // Helper function to fetch OpenAPI spec from URL
        async function fetchOpenAPISpec(url) {
          try {
            const response = await fetch(url);
            const text = await response.text();
            // Try to parse as JSON, fallback to YAML (would need a YAML parser)
            try {
              return JSON.parse(text);
            } catch {
              // If JSON parse fails, assume it's a URL we can pass directly
              return url;
            }
          } catch (err) {
            throw new Error(`Failed to fetch OpenAPI spec from ${url}: ${err.message}`);
          }
        }

        // Determine what to generate from
        if (apiType === 'openai' || (apiType === 'auto' && apiKey.startsWith('sk-'))) {
          // Create OpenAI OpenAPI spec
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'OpenAI API',
              version: '1.0.0',
              description: 'OpenAI API Client'
            },
            servers: [{ url: 'https://api.openai.com/v1' }],
            paths: {
              '/chat/completions': {
                post: {
                  operationId: 'createChatCompletion',
                  summary: 'Create chat completion',
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          required: ['model', 'messages'],
                          properties: {
                            model: { type: 'string', default: 'gpt-3.5-turbo' },
                            messages: { 
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                                  content: { type: 'string' }
                                }
                              }
                            },
                            temperature: { type: 'number', default: 1 },
                            max_tokens: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              },
              '/completions': {
                post: {
                  operationId: 'createCompletion',
                  summary: 'Create completion',
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          required: ['model', 'prompt'],
                          properties: {
                            model: { type: 'string' },
                            prompt: { type: 'string' },
                            max_tokens: { type: 'integer' },
                            temperature: { type: 'number' }
                          }
                        }
                      }
                    }
                  },
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                BearerAuth: {
                  type: 'http',
                  scheme: 'bearer'
                }
              }
            },
            security: [{ BearerAuth: [] }]
          };
        } else if (apiType === 'github' || (apiType === 'auto' && apiKey.startsWith('ghp_'))) {
          // Fetch GitHub OpenAPI spec
          specInput = await fetchOpenAPISpec(API_SPECS.github);
        } else if (apiType === 'stripe' || (apiType === 'auto' && (apiKey.startsWith('sk_live_') || apiKey.startsWith('sk_test_')))) {
          // Fetch Stripe OpenAPI spec
          specInput = await fetchOpenAPISpec(API_SPECS.stripe);
        } else if (apiType === 'google') {
          // Google APIs - use discovery API or create basic spec
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'Google APIs',
              version: '1.0.0',
              description: 'Google APIs Client - Specify endpoint URL for specific API'
            },
            servers: [{ url: 'https://www.googleapis.com' }],
            paths: {
              '/': {
                get: {
                  operationId: 'googleApiRequest',
                  summary: 'Google API Request',
                  description: 'Use custom URL to specify the exact Google API endpoint',
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                ApiKeyAuth: {
                  type: 'apiKey',
                  in: 'query',
                  name: 'key'
                },
                BearerAuth: {
                  type: 'http',
                  scheme: 'bearer'
                }
              }
            },
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }]
          };
        } else if (apiType === 'aws') {
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'AWS API',
              version: '1.0.0',
              description: 'AWS API Client - Use custom URL for specific AWS service endpoint'
            },
            servers: [{ url: 'https://api.aws.amazon.com' }],
            paths: {
              '/': {
                post: {
                  operationId: 'awsApiRequest',
                  summary: 'AWS API Request',
                  description: 'AWS APIs use signature-based authentication',
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                AwsSignature: {
                  type: 'apiKey',
                  in: 'header',
                  name: 'Authorization',
                  description: 'AWS Signature Version 4'
                }
              }
            },
            security: [{ AwsSignature: [] }]
          };
        } else if (apiType === 'azure') {
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'Azure API',
              version: '1.0.0',
              description: 'Azure API Client - Use custom URL for specific Azure service'
            },
            servers: [{ url: 'https://management.azure.com' }],
            paths: {
              '/': {
                get: {
                  operationId: 'azureApiRequest',
                  summary: 'Azure API Request',
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                BearerAuth: {
                  type: 'http',
                  scheme: 'bearer'
                }
              }
            },
            security: [{ BearerAuth: [] }]
          };
        } else if (apiType === 'slack') {
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'Slack API',
              version: '1.0.0',
              description: 'Slack API Client'
            },
            servers: [{ url: 'https://slack.com/api' }],
            paths: {
              '/chat.postMessage': {
                post: {
                  operationId: 'postMessage',
                  summary: 'Post a message to a channel',
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          required: ['channel', 'text'],
                          properties: {
                            channel: { type: 'string' },
                            text: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                BearerAuth: {
                  type: 'http',
                  scheme: 'bearer'
                }
              }
            },
            security: [{ BearerAuth: [] }]
          };
        } else if (apiType === 'discord') {
          specInput = {
            openapi: '3.0.0',
            info: {
              title: 'Discord API',
              version: '1.0.0',
              description: 'Discord API Client'
            },
            servers: [{ url: 'https://discord.com/api/v10' }],
            paths: {
              '/channels/{channelId}/messages': {
                post: {
                  operationId: 'createMessage',
                  summary: 'Create a message in a channel',
                  parameters: [
                    {
                      name: 'channelId',
                      in: 'path',
                      required: true,
                      schema: { type: 'string' }
                    }
                  ],
                  requestBody: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          required: ['content'],
                          properties: {
                            content: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: { type: 'object', additionalProperties: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              securitySchemes: {
                BearerAuth: {
                  type: 'http',
                  scheme: 'bearer'
                }
              }
            },
            security: [{ BearerAuth: [] }]
          };
        } else if (apiType === 'custom' && customUrl) {
          specInput = customUrl;
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Please specify API type or provide a custom URL' 
          }));
          return;
        }

        // Generate the client
        const { client, className } = generateClientArtifacts(specInput, {
          includeExample: false,
          apiKey: apiKey,
          outputFileName: 'api-client.ts'
        });

        // Return the generated code
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          clientCode: client,
          fileName: `${className.toLowerCase()}-client.ts`,
          className: className
        }));

      } catch (err) {
        console.error('Generation error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: err.message || 'Failed to generate client' 
        }));
      }
    });

    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 GUI Server running at http://localhost:${PORT}`);
  console.log(`   Open in your browser to generate API clients!`);
});

