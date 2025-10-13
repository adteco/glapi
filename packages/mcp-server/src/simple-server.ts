/**
 * Simplified MCP Server for testing
 * This is a minimal implementation to test the MCP protocol
 */

export interface Env {
  CLERK_SECRET_KEY: string;
  GLAPI_API_URL: string;
  OPENAI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Only POST requests are supported',
        },
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      const body = await request.text();
      const jsonRpcRequest = JSON.parse(body);

      // Simple handler for testing
      if (jsonRpcRequest.method === 'initialize') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: jsonRpcRequest.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              logging: {},
            },
            serverInfo: {
              name: 'GLAPI MCP Server',
              version: '0.1.0',
            },
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (jsonRpcRequest.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: jsonRpcRequest.id,
          result: {
            tools: [
              {
                name: 'list_customers',
                description: 'Retrieve and search customer records',
                inputSchema: {
                  type: 'object',
                  properties: {
                    search: { type: 'string' },
                    status: { type: 'string', enum: ['active', 'inactive', 'all'] },
                    limit: { type: 'number' },
                  },
                },
              },
              {
                name: 'get_customer',
                description: 'Get detailed customer information',
                inputSchema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                  },
                  required: ['id'],
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
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Default error for unknown methods
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: jsonRpcRequest.id,
        error: {
          code: -32601,
          message: `Method not found: ${jsonRpcRequest.method}`,
        },
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error: any) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: { error: error.message },
        },
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};