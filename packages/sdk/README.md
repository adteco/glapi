# @glapi/sdk

TypeScript SDK for GLAPI - General Ledger and Accounting API.

## Installation

```bash
npm install @glapi/sdk
# or
pnpm add @glapi/sdk
# or
yarn add @glapi/sdk
```

## Quick Start

```typescript
import { GlapiClient } from '@glapi/sdk';

// Create a client with your Clerk authentication token
const client = new GlapiClient({
  baseUrl: 'https://api.glapi.io/api',
  token: 'your-clerk-token',
});

// List all customers
const customers = await client.customers.list();

// Get a specific customer
const customer = await client.customers.get('customer-id');

// Create a new vendor
const vendor = await client.vendors.create({
  name: 'Acme Corporation',
  email: 'billing@acme.com',
});
```

## Configuration

### Static Token

```typescript
import { GlapiClient } from '@glapi/sdk';

const client = new GlapiClient({
  baseUrl: 'https://api.glapi.io/api',
  token: 'your-static-token',
});
```

### Dynamic Token (React/Next.js with Clerk)

```typescript
import { GlapiClient, configure } from '@glapi/sdk';
import { useAuth } from '@clerk/nextjs';

// In a React component or hook
function useGlapiClient() {
  const { getToken } = useAuth();

  const client = new GlapiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    token: async () => {
      const token = await getToken();
      return token ?? '';
    },
  });

  return client;
}
```

### Global Configuration

```typescript
import { configure, glapi } from '@glapi/sdk';

// Configure once at app startup
configure({
  baseUrl: 'https://api.glapi.io/api',
  token: 'your-token',
});

// Use the pre-configured default client
const customers = await glapi.customers.list();
```

## Available Resources

### Core Accounting Dimensions

| Resource | Methods |
|----------|---------|
| `customers` | list, get, create, update, delete |
| `vendors` | list, get, create, update, delete |
| `accounts` | list, get, create, update, delete |

### Organizational Structure

| Resource | Methods |
|----------|---------|
| `organizations` | list, get, create, update, delete |
| `subsidiaries` | list, get, create, update, delete |
| `departments` | list, get, create, update, delete |
| `locations` | list, get, create, update, delete |
| `classes` | list, get, create, update, delete |

### Inventory & Items

| Resource | Methods |
|----------|---------|
| `items` | list, get, create, update, delete |
| `warehouses` | list, get, create, update, delete |
| `priceLists` | list, get, create, update, delete |
| `unitsOfMeasure` | list, get, create, update, delete |

### Financial Operations

| Resource | Methods |
|----------|---------|
| `invoices` | list, get, create, update, delete |
| `payments` | list, get, create, update, delete |
| `subscriptions` | list, get, create, update, delete |
| `revenue` | list, get, create, update, delete |
| `transactions` | list, get, create, update, delete |

### People & Contacts

| Resource | Methods |
|----------|---------|
| `employees` | list, get, create, update, delete |
| `contacts` | list, get, create, update, delete |
| `leads` | list, get, create, update, delete |
| `prospects` | list, get, create, update, delete |

## Examples

### Working with Customers

```typescript
import { GlapiClient } from '@glapi/sdk';

const client = new GlapiClient({ token: 'your-token' });

// List all customers
const { data: customers } = await client.customers.list();

// Create a new customer
const newCustomer = await client.customers.create({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-555-0123',
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
  },
});

// Update a customer
await client.customers.update(newCustomer.id, {
  phone: '+1-555-9999',
});

// Delete a customer
await client.customers.delete(newCustomer.id);
```

### Working with Invoices

```typescript
// Create an invoice
const invoice = await client.invoices.create({
  customerId: 'customer-123',
  items: [
    {
      description: 'Consulting Services',
      quantity: 10,
      unitPrice: 150.00,
    },
  ],
  dueDate: '2026-02-28',
});

// List all invoices
const invoices = await client.invoices.list();
```

### Error Handling

```typescript
import { ApiError } from '@glapi/sdk';

try {
  const customer = await client.customers.get('non-existent-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error: ${error.status} - ${error.message}`);
    // Handle specific error codes
    if (error.status === 404) {
      console.error('Customer not found');
    } else if (error.status === 401) {
      console.error('Authentication required');
    }
  }
}
```

## Advanced Usage

### Using Individual Services

For more control, you can import and use individual services directly:

```typescript
import { CustomersService, OpenAPI } from '@glapi/sdk';

// Configure globally
OpenAPI.BASE = 'https://api.glapi.io/api';
OpenAPI.TOKEN = 'your-token';

// Use service directly
const customers = await CustomersService.customersList();
```

### Custom Headers

```typescript
const client = new GlapiClient({
  baseUrl: 'https://api.glapi.io/api',
  token: 'your-token',
  headers: {
    'X-Custom-Header': 'custom-value',
  },
});
```

## TypeScript Support

This SDK is written in TypeScript and provides full type definitions. All API responses and request bodies are typed.

```typescript
import type { OpenAPIConfig } from '@glapi/sdk';

// Types are available for configuration
const config: Partial<OpenAPIConfig> = {
  BASE: 'https://api.glapi.io/api',
  TOKEN: 'your-token',
};
```

## Development

```bash
# Install dependencies
pnpm install

# Generate SDK from OpenAPI spec
pnpm generate

# Build the package
pnpm build

# Type check
pnpm type-check
```

## License

MIT
