/**
 * Core MCP Server Implementation
 * This file contains the essential MCP protocol implementation for Cloudflare Workers
 */

import { MCPErrorCode, type MCPError, type MCPRequest, type MCPResponse } from './types';

// Environment variables type
interface Env {
  CLERK_SECRET_KEY: string;
  GLAPI_API_URL: string;
  OPENAI_API_KEY?: string;
}

// Tool definition
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool handler function
type ToolHandler = (args: any, context: AuthContext) => Promise<ToolResponse>;

// Tool response
interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Authentication context
export interface AuthContext {
  userId: string;
  organizationId: string;
  permissions: string[];
  env: Env;
}

/**
 * MCP Server Class
 * Handles the Model Context Protocol for AI tool execution
 */
export class MCPServer {
  private tools: Map<string, { tool: Tool; handler: ToolHandler }> = new Map();
  private initialized = false;
  private serverInfo = {
    name: 'Your App MCP Server',
    version: '1.0.0',
  };

  /**
   * Register a tool with the server
   */
  registerTool(tool: Tool, handler: ToolHandler): void {
    this.tools.set(tool.name, { tool, handler });
  }

  /**
   * Handle incoming MCP requests
   */
  async handleRequest(request: MCPRequest, env: Env): Promise<MCPResponse> {
    console.log(`[MCP Server] Handling request: ${request.method}`);

    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        
        case 'tools/list':
          return this.handleToolsList(request);
        
        case 'tools/call':
          return await this.handleToolCall(request, env);
        
        default:
          return this.createErrorResponse(
            request.id,
            MCPErrorCode.MethodNotFound,
            `Unknown method: ${request.method}`
          );
      }
    } catch (error) {
      console.error('[MCP Server] Request handling error:', error);
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InternalError,
        error instanceof Error ? error.message : 'Internal server error'
      );
    }
  }

  /**
   * Handle initialization request
   */
  private handleInitialize(request: MCPRequest): MCPResponse {
    this.initialized = true;
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '0.1.0',
        capabilities: {
          tools: {},
        },
        serverInfo: this.serverInfo,
      },
    };
  }

  /**
   * Handle tools list request
   */
  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools = Array.from(this.tools.values()).map(({ tool }) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools },
    };
  }

  /**
   * Handle tool execution
   */
  private async handleToolCall(request: MCPRequest, env: Env): Promise<MCPResponse> {
    const { name, arguments: args } = request.params as {
      name: string;
      arguments?: any;
    };

    const toolEntry = this.tools.get(name);
    if (!toolEntry) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InvalidParams,
        `Unknown tool: ${name}`
      );
    }

    try {
      // Extract auth context from request
      const authContext = await this.getAuthContext(request, env);
      
      // Execute the tool
      const result = await toolEntry.handler(args || {}, authContext);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      console.error(`[MCP Server] Tool execution error for ${name}:`, error);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Tool execution failed'}`,
          }],
          isError: true,
        },
      };
    }
  }

  /**
   * Extract authentication context from request
   */
  private async getAuthContext(request: MCPRequest, env: Env): Promise<AuthContext> {
    // In a real implementation, validate the auth token here
    // For Cloudflare Workers, auth info might come from headers
    
    // Development/demo context
    return {
      userId: 'user_demo',
      organizationId: 'org_demo',
      permissions: ['read', 'write'],
      env,
    };
  }

  /**
   * Create an error response
   */
  private createErrorResponse(id: string | number | null, code: MCPErrorCode, message: string): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
      },
    };
  }
}

/**
 * Cloudflare Worker Entry Point
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      // Parse the JSON-RPC request
      const mcpRequest = await request.json() as MCPRequest;
      
      // Create server instance and register tools
      const server = new MCPServer();
      
      // Register your tools here
      // Example: registerCustomerTools(server);
      // Example: registerVendorTools(server);
      
      // Handle the request
      const mcpResponse = await server.handleRequest(mcpRequest, env);
      
      return new Response(
        JSON.stringify(mcpResponse),
        { headers: corsHeaders }
      );
    } catch (error) {
      console.error('[MCP Server] Request processing error:', error);
      
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: MCPErrorCode.ParseError,
            message: 'Invalid request',
          },
        }),
        { status: 400, headers: corsHeaders }
      );
    }
  },
};

/**
 * MCP Type Definitions
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  data?: any;
}

export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}