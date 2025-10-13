/**
 * GLAPI MCP Server - Cloudflare Worker Entry Point
 * 
 * This worker provides MCP (Model Context Protocol) access to GLAPI business operations.
 * It exposes tools for customer management, invoicing, transactions, and reporting.
 */

import { MCPServer } from './mcp/server';
import { registerAllTools } from './tools';
import type { Env } from './mcp/auth';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log('[MCP Server] Received request:', request.method, request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      console.log('[MCP Server] Handling CORS preflight');
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

    try {
      // Initialize MCP server
      console.log('[MCP Server] Initializing server with env keys:', Object.keys(env));
      const server = new MCPServer(env);
      
      // Register all available tools
      console.log('[MCP Server] Registering tools');
      registerAllTools(server);
      
      // Handle the request (let the server handle body reading)
      console.log('[MCP Server] Handling request');
      const response = await server.handleRequest(request);
      
      console.log('[MCP Server] Response status:', response.status);
      
      // Schedule cleanup for next execution
      ctx.waitUntil(Promise.resolve().then(() => server.cleanup()));
      
      return response;
      
    } catch (error: any) {
      console.error('[MCP Server] Worker error:', error);
      console.error('[MCP Server] Error stack:', error.stack);
      
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal server error',
            data: { 
              error: error.message,
              stack: error.stack,
            },
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Periodic cleanup tasks
    console.log('Running scheduled cleanup tasks');
    
    // You can add periodic maintenance tasks here
    // For example: cleanup old cache entries, log rotation, etc.
  },
};