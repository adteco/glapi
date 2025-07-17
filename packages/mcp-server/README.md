# GLAPI MCP Server

A Model Context Protocol (MCP) server that provides AI agents with structured access to GLAPI business operations. This server runs as a Cloudflare Worker and exposes tools for customer management, invoicing, transactions, and reporting.

## Features

### 🔧 Available Tools

**Customer Management**
- `list_customers` - Search and filter customer records
- `get_customer` - Get detailed customer information
- `create_customer` - Create new customer records
- `update_customer` - Update existing customer information

**Invoice Management**
- `create_invoice` - Generate new invoices for customers
- `list_invoices` - Retrieve invoices with filtering options
- `get_invoice` - Get detailed invoice information
- `send_invoice` - Send invoices to customers via email

**Transaction Processing**
- `create_sales_order` - Create sales orders
- `record_payment` - Record payments against invoices
- `create_estimate` - Generate estimates/quotes
- `convert_estimate_to_invoice` - Convert estimates to invoices

**Reporting & Analytics**
- `financial_summary` - High-level financial metrics
- `customer_analytics` - Customer performance analysis
- `sales_report` - Sales performance reports

### 🔐 Security Features

- **Clerk JWT Authentication** - Validates user tokens
- **Organization Scoping** - All operations limited to user's organization
- **Permission-based Access** - Role-based operation permissions
- **Rate Limiting** - Protects against abuse
- **Audit Logging** - Tracks all operations

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account
- Wrangler CLI

### Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure environment variables**
   ```bash
   # Copy and update environment template
   cp wrangler.example.toml wrangler.toml
   
   # Set secrets
   wrangler secret put CLERK_SECRET_KEY
   wrangler secret put DATABASE_URL
   wrangler secret put GLAPI_API_URL
   ```

3. **Start development server**
   ```bash
   pnpm dev
   ```

### Environment Variables

#### Required Secrets
- `CLERK_SECRET_KEY` - Clerk JWT validation key
- `GLAPI_API_URL` - Backend API URL

#### Optional Secrets
- `OPENAI_API_KEY` - For enhanced AI features

#### Public Variables (in wrangler.toml)
- `MCP_SERVER_VERSION` - Server version
- `LOG_LEVEL` - Logging level
- `RATE_LIMIT_REQUESTS_PER_MINUTE` - Rate limiting
- `CACHE_TTL_SECONDS` - Cache configuration

## Deployment

### Development
```bash
pnpm deploy:dev
```

### Staging
```bash
pnpm deploy:staging
```

### Production
```bash
pnpm deploy:prod
```

## Usage

### MCP Protocol

The server implements the Model Context Protocol (MCP) specification. It accepts JSON-RPC 2.0 requests over HTTP.

#### Initialize Connection
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "AI Assistant",
      "version": "1.0.0"
    },
    "capabilities": {}
  }
}
```

#### List Available Tools
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

#### Call a Tool
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_customer",
    "arguments": {
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "phone": "555-0123"
    }
  }
}
```

### Authentication

All requests (except `initialize`) must include a Bearer token in the Authorization header:

```
Authorization: Bearer <clerk-jwt-token>
```

The token must contain valid user and organization information.

### Error Handling

The server returns standard JSON-RPC error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Authentication required",
    "data": {}
  }
}
```

#### Error Codes
- `-32700` Parse Error
- `-32600` Invalid Request
- `-32601` Method Not Found
- `-32602` Invalid Params
- `-32603` Internal Error
- `-32000` Authentication Required
- `-32001` Authorization Failed
- `-32002` Rate Limit Exceeded
- `-32003` Resource Not Found
- `-32004` Validation Failed

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Client     │    │   MCP Server    │    │  GLAPI Backend  │
│                 │◄──►│ (CF Worker)     │◄──►│   (tRPC API)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

- **MCP Server** (`src/mcp/server.ts`) - Core protocol implementation
- **Authentication** (`src/mcp/auth.ts`) - JWT validation and permissions
- **Tools** (`src/tools/`) - Business operation implementations
- **tRPC Client** (`src/services/trpc-client.ts`) - Backend API integration

## Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
pnpm test:integration
```

### Coverage Report
```bash
pnpm test:coverage
```

## Monitoring

### Logs
View worker logs in Cloudflare Dashboard or via CLI:
```bash
wrangler tail
```

### Metrics
Monitor usage and performance in Cloudflare Analytics:
- Request volume
- Error rates
- Response times
- Geographic distribution

### Alerts
Set up alerts for:
- High error rates
- Unusual traffic patterns
- Authentication failures
- Rate limit violations

## Contributing

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- 100% test coverage for new features

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create GitHub issue
- Contact development team
- Check documentation at docs/mcp-agent-design.md