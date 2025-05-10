# Full Stack Architecture with Stytch Auth & Multi-Cloud Deployment

## Architecture Overview

```
Frontend (Next.js) → Vercel
    ↓ (API calls)
Lambda Functions → AWS
    ↓ (Database queries)
Supabase PostgreSQL + RLS
    ↓ (Auth)
Stytch Authentication
```

## Authentication with Stytch

### Frontend Auth Setup

```typescript
// packages/web/src/lib/stytch.ts
import * as stytch from '@stytch/vanilla-js';

export const stytchClient = new stytch.Client({
  publicToken: process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN!
});

// packages/web/src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { stytchClient } from '../lib/stytch';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      const currentUser = await stytchClient.sessions.get();
      setUser(currentUser?.user || null);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string) => {
    try {
      await stytchClient.passwords.email.loginOrCreate({
        email,
        session_duration_minutes: 60 * 24 * 30 // 30 days
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await stytchClient.sessions.delete();
    setUser(null);
  };

  return { user, loading, login, logout };
};

// packages/web/src/pages/_app.tsx
import { AuthProvider } from '../contexts/AuthContext';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

### Lambda Auth Middleware

```typescript
// packages/lambdas/shared/src/middleware/auth.ts
import { APIGatewayProxyEvent } from 'aws-lambda';
import { verify } from 'jsonwebtoken';
import StytchClient from 'stytch';

const stytchClient = new StytchClient({
  projectId: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!
});

export const authenticateUser = async (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    throw new Error('No authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    // Verify Stytch session
    const user = await stytchClient.sessions.authenticate({
      session_token: token
    });
    
    return user;
  } catch (error) {
    throw new Error('Invalid authentication');
  }
};

// packages/lambdas/shared/src/middleware/withAuth.ts
export const withAuth = (handler: any) => {
  return async (event: APIGatewayProxyEvent) => {
    try {
      const user = await authenticateUser(event);
      // Attach user to event for use in handler
      event.requestContext = {
        ...event.requestContext,
        user
      };
      
      return handler(event);
    } catch (error) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: error.message || 'Unauthorized'
        })
      };
    }
  };
};
```

## Database with Drizzle ORM and RLS

### Drizzle Schema Definition

```typescript
// packages/database/src/schema.ts
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  pgEnum,
  jsonb,
  boolean,
  serial
} from 'drizzle-orm/pg-core';

// Enable RLS
export const enableRLS = sql`ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;`;

// Define tables with RLS
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  customerId: varchar('customer_id', { length: 100 }).unique().notNull(),
  billingAddress: jsonb('billing_address'),
  userId: uuid('user_id').notNull(), // References Stytch user ID
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  contractNumber: varchar('contract_number', { length: 100 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  contractDate: timestamp('contract_date').notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  contractValue: decimal('contract_value', { precision: 12, scale: 2 }).notNull(),
  contractStatus: pgEnum('contract_status', ['draft', 'signed', 'active', 'completed', 'terminated'])().notNull(),
  userId: uuid('user_id').notNull(), // Owner of the contract
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// ... other tables with userId field for RLS
```

### RLS Policies

```sql
-- packages/database/migrations/001_enable_rls.sql

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only view their own customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only view their own contracts"
  ON contracts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to get current user from Stytch JWT
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
$$ LANGUAGE sql STABLE;

-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'role')::text;
$$ LANGUAGE sql STABLE;
```

### Drizzle Database Connection

```typescript
// packages/lambdas/shared/src/db/drizzle.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../database/src/schema';

const connectionString = process.env.SUPABASE_DB_URL!;

// Create connection with RLS headers
export const createDrizzleClient = (userToken: string) => {
  const client = postgres(connectionString, {
    prepare: false,
    // Pass Stytch JWT for RLS
    transform: postgres.camel,
    connection: {
      application_name: 'revenue-recognition-app',
      options: `-c statement_timeout=30000`,
      statement_timeout: 30000,
      // Set RLS context
      session: {
        'request.jwt.claims': JSON.stringify({
          sub: userToken // Stytch user ID
        })
      }
    }
  });
  
  return drizzle(client, { schema });
};

// Usage in Lambda
export const getDbClient = (event: APIGatewayProxyEvent) => {
  const user = event.requestContext.user;
  if (!user) throw new Error('User not authenticated');
  
  return createDrizzleClient(user.user_id);
};
```

## Local Development Setup

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: revenue_recognition
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./packages/database/scripts/init.sql:/docker-entrypoint-initdb.d/init.sql

  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=lambda,apigateway,s3
      - LAMBDA_EXECUTOR=docker
      - DEFAULT_REGION=us-east-1
    volumes:
      - localstack_data:/tmp/localstack

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  localstack_data:
```

### Local Development Scripts

```bash
# scripts/setup-local.sh
#!/bin/bash

# Install dependencies
npm install

# Start Docker services
docker-compose up -d

# Wait for services to be ready
sleep 10

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed

# Generate Drizzle types
npm run db:generate

# Start development servers
npm run dev
```

## Deployment Configuration

### Vercel Configuration

```json
// packages/web/vercel.json
{
  "github": {
    "silent": true
  },
  "buildCommand": "turbo run build --filter=web",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN": "@stytch_public_token",
    "NEXT_PUBLIC_API_URL": "@api_url",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

### AWS Lambda Deployment

```yaml
# packages/lambdas/contract-processor/serverless.yml
service: revenue-recognition-contracts

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
  environment:
    STAGE: ${self:provider.stage}
    SUPABASE_URL: ${env:SUPABASE_URL}
    SUPABASE_ANON_KEY: ${env:SUPABASE_ANON_KEY}
    STYTCH_PROJECT_ID: ${env:STYTCH_PROJECT_ID}
    STYTCH_SECRET: ${env:STYTCH_SECRET}
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - secretsmanager:GetSecretValue
          Resource: "arn:aws:secretsmanager:*:*:secret:revenue-recognition-*"

functions:
  createContract:
    handler: dist/index.handler
    events:
      - httpApi:
          path: /contracts
          method: post
          authorizer:
            type: jwt
            identitySource: $request.header.Authorization
            issuerUrl: https://api.stytch.com
            audience: ${env:STYTCH_PROJECT_ID}

resources:
  Resources:
    HttpApiGateway:
      Type: AWS::ApiGatewayV2::Api
      Properties:
        CorsConfiguration:
          AllowOrigins: 
            - "https://${self:custom.frontend.domain}"
          AllowHeaders:
            - Content-Type
            - Authorization
          AllowMethods:
            - GET
            - POST
            - PUT
            - DELETE
```

### Supabase Configuration

```typescript
// packages/database/supabase/config.toml
[auth]
enabled = false  # We're using Stytch

[api]
enabled = true
port = 54321
schemas = ["public", "revenue_recognition"]
extra_search_path = ["public"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[auth.external.stytch]
enabled = true
client_id = "${STYTCH_PROJECT_ID}"
secret = "${STYTCH_SECRET}"
```

## Environment Configuration

### Development Environment

```bash
# .env.local
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=test_public_token
STYTCH_PROJECT_ID=project-id
STYTCH_SECRET=secret
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revenue_recognition
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test

  deploy-lambdas:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: serverless/github-action@v3
        with:
          args: deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Development Workflow

### Local Development Commands

```bash
# Start local development
npm run dev:local

# Run database migrations
npm run db:migrate

# Generate Drizzle types
npm run db:generate

# Run tests
npm run test:all

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:local": "docker-compose up -d && npm run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:all": "turbo run test && npm run test:e2e",
    "db:migrate": "cd packages/database && drizzle-kit push:pg",
    "db:generate": "cd packages/database && drizzle-kit generate:pg",
    "db:studio": "cd packages/database && drizzle-kit studio",
    "deploy:staging": "turbo run deploy --filter='!web' && vercel --prod=false",
    "deploy:prod": "turbo run deploy --filter='!web' && vercel --prod"
  }
}
```

This setup provides:

1. **Local Development** with Docker containers for PostgreSQL and LocalStack
2. **Authentication** using Stytch with JWT sessions
3. **Database Security** with RLS policies based on user context
4. **Multi-Cloud Deployment** with AWS Lambda, Vercel, and Supabase
5. **Type Safety** using Drizzle ORM with TypeScript
6. **CI/CD Pipeline** for automated testing and deployment

The system can run entirely locally for development and seamlessly deploy to production across multiple cloud providers while maintaining security and performance.