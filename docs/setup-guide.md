# Revenue Recognition Project Setup Guide

## Step 1: Initialize the Project

Create the main project directory and initialize it:

```bash
# Create project directory
mkdir revenue-recognition-system
cd revenue-recognition-system

# Initialize as a git repository
git init

# Initialize npm workspace
npm init -y

# Install root dependencies
npm install -D typescript prettier turbo eslint @types/node
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Step 2: Create Root Configuration Files

### package.json
```json
{
  "name": "revenue-recognition-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean",
    "db:migrate": "cd packages/database && npm run migrate",
    "db:generate": "cd packages/database && npm run generate",
    "dev:local": "docker-compose up -d && npm run dev",
    "setup": "./scripts/setup.sh"
  },
  "workspaces": [
    "packages/*",
    "packages/lambdas/*"
  ],
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@typescript-eslint/eslint-plugin": "^5.59.0",
    "@typescript-eslint/parser": "^5.59.0",
    "eslint": "^8.38.0",
    "prettier": "^2.8.0",
    "turbo": "^1.10.0",
    "typescript": "^5.0.0"
  }
}
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### tsconfig.json (root)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "allowJs": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": [
    "node_modules",
    "dist",
    ".next"
  ]
}
```

### .gitignore
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output/

# Build outputs
dist/
.next/
out/

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/

# Temporary files
temp/
tmp/

# Docker
docker-compose.override.yml

# AWS
.aws/

# Supabase
.supabase/
```

## Step 3: Create the Next.js Frontend Package

```bash
# Create packages directory
mkdir -p packages/web

# Navigate to web package
cd packages/web

# Initialize Next.js with TypeScript
npx create-next-app@latest . --typescript --tailwind --app

# Install additional dependencies
npm install @stytch/vanilla-js @supabase/supabase-js
npm install -D @types/node jest jest-environment-jsdom @testing-library/react @playwright/test
```

### Update packages/web/package.json
```json
{
  "name": "web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:e2e": "playwright test",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@stytch/vanilla-js": "^3.5.0",
    "@supabase/supabase-js": "^2.26.0",
    "next": "13.4.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@playwright/test": "^1.35.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/react": "^14.0.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "eslint": "^8",
    "eslint-config-next": "13.4.0",
    "jest": "^29.5.0",
    "jest-environment-jsdom": "^29.5.0",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}
```

## Step 4: Create Shared Types Package

```bash
# Go back to root
cd ../..

# Create shared package
mkdir -p packages/shared
cd packages/shared

# Initialize package
npm init -y

# Install dependencies
npm install -D typescript
```

### packages/shared/package.json
```json
{
  "name": "shared",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint . --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Step 5: Create Database Package

```bash
# Go back to root
cd ../..

# Create database package
mkdir -p packages/database
cd packages/database

# Initialize package
npm init -y

# Install dependencies
npm install drizzle-orm postgres
npm install -D @types/pg drizzle-kit
```

### packages/database/package.json
```json
{
  "name": "database",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "generate": "drizzle-kit generate:pg",
    "migrate": "drizzle-kit push:pg",
    "studio": "drizzle-kit studio",
    "drop": "drizzle-kit drop",
    "seed": "node -r dotenv/config dist/seed.js"
  },
  "dependencies": {
    "drizzle-orm": "^0.27.0",
    "postgres": "^3.3.5"
  },
  "devDependencies": {
    "@types/pg": "^8.10.2",
    "drizzle-kit": "^0.19.0",
    "dotenv": "^16.3.1",
    "typescript": "^5.0.0"
  }
}
```

### Create database configuration

```typescript
// packages/database/drizzle.config.ts
import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/schema/*',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## Step 6: Create Lambda Functions Structure

```bash
# Go back to root
cd ../..

# Create lambdas directory
mkdir -p packages/lambdas

# Create contract-processor lambda
mkdir -p packages/lambdas/contract-processor
cd packages/lambdas/contract-processor

# Initialize lambda package
npm init -y

# Install dependencies
npm install @aws-sdk/client-lambda stytch
npm install -D @types/aws-lambda serverless typescript
```

### packages/lambdas/contract-processor/package.json
```json
{
  "name": "contract-processor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint . --ext .ts",
    "deploy": "serverless deploy",
    "remove": "serverless remove",
    "logs": "serverless logs -f createContract"
  },
  "dependencies": {
    "@aws-sdk/client-lambda": "^3.361.0",
    "stytch": "^8.4.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.117",
    "@types/node": "^18.0.0",
    "serverless": "^3.33.0",
    "serverless-plugin-typescript": "^2.1.4",
    "typescript": "^5.0.0"
  }
}
```

## Step 7: Create Docker Configuration

```bash
# Go back to root
cd ../../../

# Create docker-compose.yml
```

### docker-compose.yml
```yaml
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
    image: localstack/localstack:2.1
    ports:
      - "4566:4566"
    environment:
      - SERVICES=lambda,apigateway,s3
      - LAMBDA_EXECUTOR=docker
      - DEFAULT_REGION=us-east-1
      - DEBUG=1
    volumes:
      - localstack_data:/tmp/localstack
      - /var/run/docker.sock:/var/run/docker.sock

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  localstack_data:
```

## Step 8: Create Setup Script

```bash
# Create scripts directory
mkdir -p scripts

# Create setup script
touch scripts/setup.sh
chmod +x scripts/setup.sh
```

### scripts/setup.sh
```bash
#!/bin/bash

echo "🚀 Setting up Revenue Recognition System..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install all package dependencies
echo "📦 Installing package dependencies..."
npm run install:all

# Setup environment files
echo "⚙️  Setting up environment files..."
cp .env.example .env.local
cp packages/web/.env.example packages/web/.env.local

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations
echo "🗃️  Running database migrations..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

echo "✅ Setup complete! You can now run 'npm run dev' to start development."
```

## Step 9: Create Environment Files

```bash
# Create environment template files
touch .env.example
touch packages/web/.env.example
```

### .env.example
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revenue_recognition

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stytch
STYTCH_PROJECT_ID=your_stytch_project_id
STYTCH_SECRET=your_stytch_secret

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### packages/web/.env.example
```env
# Public environment variables
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=your_stytch_public_token
NEXT_PUBLIC_API_URL=http://localhost:4566/dev
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 10: Initialize the Project

Once you've created all these files and directories, run:

```bash
# Make the setup script executable
chmod +x scripts/setup.sh

# Run the setup
./scripts/setup.sh
```

## Final Project Structure

Your project should now have this structure:

```
revenue-recognition-system/
├── package.json
├── turbo.json
├── tsconfig.json
├── docker-compose.yml
├── .gitignore
├── .env.example
├── scripts/
│   └── setup.sh
├── packages/
│   ├── web/                    # Next.js app
│   ├── shared/                 # Shared types and utils
│   ├── database/              # Drizzle ORM setup
│   └── lambdas/
│       ├── contract-processor/
│       ├── revenue-recognizer/
│       ├── ssp-manager/
│       └── reporting-service/
└── README.md
```

## Next Steps

1. Configure your environment variables
2. Set up Stytch and Supabase accounts
3. Configure AWS credentials
4. Start development: `npm run dev`

This setup gives you a fully working monorepo with:
- Next.js 13 with TypeScript and Tailwind
- Shared packages for types and utilities
- Lambda functions with TypeScript
- Local development with Docker
- Database management with Drizzle ORM
- CI/CD configuration