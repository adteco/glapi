import {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPServerCapabilities,
  MCPErrorCode,
  AuthContext,
} from './types';
import { authenticateRequest, checkPermission, RateLimiter, Env } from './auth';

export interface MCPToolHandler {
  (args: Record<string, any>, context: AuthContext): Promise<MCPToolResult>;
}

export class MCPServer {
  private tools = new Map<string, { definition: MCPTool; handler: MCPToolHandler }>();
  private rateLimiter: RateLimiter;
  private initialized = false;
  private static initializationState = new Map<string, boolean>(); // Track initialization per org

  constructor(private env: Env) {
    const maxRequests = parseInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60');
    this.rateLimiter = new RateLimiter(maxRequests);
  }

  /**
   * Register a tool with the server
   */
  registerTool(definition: MCPTool, handler: MCPToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return this.createCORSResponse();
      }

      if (request.method !== 'POST') {
        return this.createErrorResponse(
          null,
          MCPErrorCode.InvalidRequest,
          'Only POST requests are supported'
        );
      }

      // Parse JSON-RPC request
      const body = await request.text();
      console.log('[MCP Server] Request body:', body);
      
      let mcpRequest: MCPRequest;
      
      try {
        mcpRequest = JSON.parse(body);
        console.log('[MCP Server] Parsed request:', mcpRequest);
      } catch (error) {
        console.error('[MCP Server] JSON parse error:', error);
        return this.createErrorResponse(
          null,
          MCPErrorCode.ParseError,
          'Invalid JSON'
        );
      }

      // Validate JSON-RPC format
      if (mcpRequest.jsonrpc !== '2.0' || !mcpRequest.method) {
        return this.createErrorResponse(
          mcpRequest.id || null,
          MCPErrorCode.InvalidRequest,
          'Invalid JSON-RPC request'
        );
      }

      // Handle initialization without authentication
      if (mcpRequest.method === 'initialize') {
        return this.handleInitialize(mcpRequest);
      }

      // Authenticate all other requests
      console.log('[MCP Server] Authenticating request...');
      let authContext;
      try {
        authContext = await authenticateRequest(request, this.env);
        console.log('[MCP Server] Auth context:', {
          userId: authContext.userId,
          organizationId: authContext.organizationId,
          hasToken: !!authContext.token
        });
      } catch (authError: any) {
        console.error('[MCP Server] Authentication failed:', authError.message);
        return this.createErrorResponse(
          mcpRequest.id,
          MCPErrorCode.AuthenticationRequired,
          authError.message
        );
      }
      
      // Ensure env is included in context
      authContext.env = this.env;

      // Rate limiting
      if (!this.rateLimiter.checkLimit(authContext.organizationId)) {
        return this.createErrorResponse(
          mcpRequest.id,
          MCPErrorCode.RateLimitExceeded,
          'Rate limit exceeded'
        );
      }

      // Route request to appropriate handler
      console.log('[MCP Server] Routing request to handler...');
      try {
        const response = await this.routeRequest(mcpRequest, authContext);
        return response;
      } catch (routeError: any) {
        console.error('[MCP Server] Route error:', routeError);
        throw routeError;
      }
      
    } catch (error: any) {
      console.error('Request handling error:', error);
      
      if (error.name === 'AuthenticationError' || error.name === 'AuthorizationError') {
        return this.createErrorResponse(
          null,
          error.code,
          error.message
        );
      }

      return this.createErrorResponse(
        null,
        MCPErrorCode.InternalError,
        'Internal server error'
      );
    }
  }

  /**
   * Handle initialization request
   */
  private async handleInitialize(request: MCPRequest): Promise<Response> {
    const params = request.params as MCPInitializeRequest;
    
    if (!params.protocolVersion || !params.clientInfo) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InvalidParams,
        'Missing required initialization parameters'
      );
    }

    const capabilities: MCPServerCapabilities = {
      tools: {
        listChanged: false,
      },
      logging: {},
    };

    const response: MCPInitializeResponse = {
      protocolVersion: '2024-11-05',
      capabilities,
      serverInfo: {
        name: 'GLAPI MCP Server',
        version: '1.0.0',
      },
    };

    this.initialized = true;

    return this.createSuccessResponse(request.id, response);
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(
    request: MCPRequest,
    authContext: AuthContext
  ): Promise<Response> {
    console.log('[MCP Server] routeRequest - initialized:', this.initialized);
    console.log('[MCP Server] routeRequest - method:', request.method);
    
    // For Cloudflare Workers, we can't rely on state between requests
    // So we'll allow tool calls without initialization
    if (!this.initialized && request.method !== 'tools/call') {
      console.error('[MCP Server] Server not initialized!');
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InvalidRequest,
        'Server not initialized'
      );
    }

    switch (request.method) {
      case 'tools/list':
        console.log('[MCP Server] Handling tools/list');
        return this.handleToolsList(request, authContext);
      
      case 'tools/call':
        console.log('[MCP Server] Handling tools/call');
        return this.handleToolCall(request, authContext);
      
      default:
        console.error('[MCP Server] Unknown method:', request.method);
        return this.createErrorResponse(
          request.id,
          MCPErrorCode.MethodNotFound,
          `Method not found: ${request.method}`
        );
    }
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(
    request: MCPRequest,
    authContext: AuthContext
  ): Promise<Response> {
    const tools = Array.from(this.tools.values()).map(({ definition }) => definition);
    
    return this.createSuccessResponse(request.id, { tools });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(
    request: MCPRequest,
    authContext: AuthContext
  ): Promise<Response> {
    console.log('[MCP Server] handleToolCall called');
    const params = request.params as { name: string; arguments: Record<string, any> };
    console.log('[MCP Server] Tool params:', params);
    
    if (!params.name) {
      console.error('[MCP Server] Missing tool name');
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InvalidParams,
        'Missing tool name'
      );
    }

    const tool = this.tools.get(params.name);
    console.log('[MCP Server] Found tool:', !!tool, 'Available tools:', Array.from(this.tools.keys()));
    
    if (!tool) {
      console.error('[MCP Server] Tool not found:', params.name);
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.MethodNotFound,
        `Tool not found: ${params.name}`
      );
    }

    try {
      // Validate input against schema (basic validation)
      const args = params.arguments || {};
      
      // Call the tool handler
      const result = await tool.handler(args, authContext);
      
      return this.createSuccessResponse(request.id, result);
      
    } catch (error: any) {
      console.error(`Tool execution error for ${params.name}:`, error);
      
      if (error.name === 'AuthorizationError') {
        return this.createErrorResponse(
          request.id,
          error.code,
          error.message
        );
      }

      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InternalError,
        `Tool execution failed: ${error.message}`
      );
    }
  }

  /**
   * Create success response
   */
  private createSuccessResponse(id: string | number | null, result: any): Response {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: id!,
      result,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: any
  ): Response {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: id!,
      error: {
        code,
        message,
        data,
      },
    };

    const statusCode = code === MCPErrorCode.AuthenticationRequired ? 401 :
                      code === MCPErrorCode.AuthorizationFailed ? 403 :
                      code === MCPErrorCode.RateLimitExceeded ? 429 :
                      code === MCPErrorCode.ResourceNotFound ? 404 : 400;

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  /**
   * Create CORS preflight response
   */
  private createCORSResponse(): Response {
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

  /**
   * Cleanup resources (call periodically)
   */
  cleanup(): void {
    this.rateLimiter.cleanup();
  }
}