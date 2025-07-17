// MCP Protocol Types
// Based on Model Context Protocol specification

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
}

// Tool Definition Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Server Capability Types
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

// Initialize Request/Response
export interface MCPInitializeRequest {
  protocolVersion: string;
  capabilities: {
    roots?: {
      listChanged?: boolean;
    };
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

// Authentication Context
export interface AuthContext {
  userId: string;
  organizationId: string;
  permissions: string[];
  token: string; // Original JWT token for forwarding
  env: any; // Cloudflare Worker environment
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

// Error Codes
export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // Custom error codes
  AuthenticationRequired = -32000,
  AuthorizationFailed = -32001,
  RateLimitExceeded = -32002,
  ResourceNotFound = -32003,
  ValidationFailed = -32004,
}