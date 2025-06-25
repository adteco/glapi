# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains a monorepo for the GLAPI project, which is a revenue recognition system with an accounting dimensions API. The project is structured using Turborepo and pnpm workspaces, with three main applications and several packages:

- **apps/api**: Express.js REST API server with authentication middleware
- **apps/docs**: Documentation site built with Next.js and MDX for API documentation  
- **apps/web**: Web application built with Next.js using Stytch for authentication and shadcn/ui components
- **packages/api-service**: Service layer with business logic for customers, organizations, and accounting dimensions
- **packages/business**: Core business logic and transaction handling
- **packages/database**: Database access layer using Drizzle ORM with PostgreSQL schemas

## Common Commands

### Development

```bash
# Install dependencies with pnpm
pnpm install

# Start development server for all workspaces
pnpm dev

# Start development servers for specific workspaces
pnpm --filter web dev
pnpm --filter docs dev
pnpm dev:api  # Start the Express API server only
```

### Building

```bash
# Build all workspaces
pnpm build

# Build specific workspace
pnpm --filter web build
pnpm --filter docs build
```

### Testing and Linting

```bash
# Run linting on all workspaces
pnpm lint

# Run linting on specific workspace
pnpm --filter web lint

# Type checking
pnpm type-check

# Type checking specific workspace
pnpm --filter web type-check
```

### Database Operations

```bash
# Generate database schemas from schema files
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Test database connection
pnpm --filter database test:connection
```

## Architecture

The project follows a monorepo structure using Turborepo for task orchestration and pnpm for package management:

1. **API Server (apps/api)**:
   - Express.js REST API with CORS support
   - Route handlers for customers, organizations, classes, departments, locations, subsidiaries
   - Authentication middleware
   - Uses packages/api-service for business logic

2. **Web Application (apps/web)**:
   - Next.js application with App Router
   - Stytch for authentication and user management
   - shadcn/ui components with Radix UI primitives
   - Forms with react-hook-form and zod validation
   - CRUD interfaces for accounting dimensions

3. **Documentation (apps/docs)**:
   - Next.js with MDX for API documentation
   - Tailwind CSS for styling
   - API endpoint documentation for all accounting dimensions

4. **API Service Layer (packages/api-service)**:
   - Service classes for each accounting dimension (customers, organizations, etc.)
   - Type definitions for all entities
   - Stytch utilities for authentication
   - Base service pattern for common CRUD operations

5. **Database Layer (packages/database)**:
   - Drizzle ORM with PostgreSQL
   - Repository pattern for data access
   - Schema definitions for accounting dimensions and revenue recognition entities
   - Migration scripts and database connection utilities

The system is designed around accounting dimensions (customers, organizations, subsidiaries, departments, locations, classes) with a focus on revenue recognition, contract management, and performance obligation tracking. The API follows RESTful conventions with consistent patterns across all dimension endpoints.

## Development Notes

- The project uses TypeScript throughout for type safety
- Zod is used for runtime validation across API and web layers
- The API server uses Express.js with middleware for authentication and CORS
- Repository and service patterns provide consistent data access and business logic
- All accounting dimensions follow the same CRUD pattern for consistency
- Tests can be run on individual packages with `pnpm --filter <package> test`

## Important: Monorepo Import Guidelines

- **DO NOT use relative paths between packages** - This is a monorepo managed by pnpm workspaces
- Always import packages using their package names as defined in their package.json
- Example: Use `import { something } from '@glapi/database'` NOT `import { something } from '../database'`
- Each package should be treated as an independent module with its own dependencies
- The monorepo tooling (pnpm and Turborepo) handles the linking between packages automatically