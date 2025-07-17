/**
 * Mock MCP Server for testing
 * This provides a working implementation without complex dependencies
 */

export interface Env {
  CLERK_SECRET_KEY?: string;
  GLAPI_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('[Mock MCP] Request:', request.method, request.url);

    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.text();
      console.log('[Mock MCP] Body:', body);
      
      const jsonRpcRequest = JSON.parse(body);
      const { method, params, id } = jsonRpcRequest;

      // Handle different MCP methods
      if (method === 'initialize') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'GLAPI Mock MCP Server',
              version: '0.1.0',
            },
          },
        }), { status: 200, headers: corsHeaders });
      }

      if (method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'list_customers',
                description: 'List customers',
                inputSchema: {
                  type: 'object',
                  properties: {
                    search: { type: 'string' },
                    status: { type: 'string' },
                    limit: { type: 'number' },
                  },
                },
              },
              {
                name: 'create_customer',
                description: 'Create a new customer',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            ],
          },
        }), { status: 200, headers: corsHeaders });
      }

      if (method === 'tools/call') {
        const { name: toolName, arguments: args } = params;
        console.log('[Mock MCP] Tool call:', toolName, args);

        // Mock responses for different tools
        if (toolName === 'create_customer') {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    customer: {
                      id: 'mock-' + Date.now(),
                      name: args.name,
                      email: args.email,
                      phone: args.phone,
                      status: 'active',
                      createdAt: new Date().toISOString(),
                    },
                    message: `Successfully created customer "${args.name}"`,
                  }, null, 2),
                },
              ],
            },
          }), { status: 200, headers: corsHeaders });
        }

        if (toolName === 'list_customers') {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    customers: [
                      {
                        id: 'mock-1',
                        name: 'Acme Corp',
                        email: 'contact@acme.com',
                        status: 'active',
                      },
                      {
                        id: 'mock-2',
                        name: 'Tech Industries',
                        email: 'info@tech.com',
                        status: 'active',
                      },
                    ],
                    total: 2,
                  }, null, 2),
                },
              ],
            },
          }), { status: 200, headers: corsHeaders });
        }

        // Unknown tool
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown tool: ${toolName}`,
          },
        }), { status: 404, headers: corsHeaders });
      }

      // Unknown method
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      }), { status: 404, headers: corsHeaders });

    } catch (error: any) {
      console.error('[Mock MCP] Error:', error);
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: { error: error.message },
        },
      }), { status: 500, headers: corsHeaders });
    }
  },
};