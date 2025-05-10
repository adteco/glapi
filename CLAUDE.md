# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains a monorepo for the GLAPI project, which appears to be a revenue recognition system using Stytch for authentication. The project is structured using Turborepo and pnpm workspaces, with several key applications and packages:

- **apps/docs**: Documentation site built with Next.js 
- **apps/web**: Web application built with Next.js using Stytch for authentication
- **packages/api-service**: API service for interacting with backend services
- **packages/business**: Business logic layer
- **packages/database**: Database access layer using Drizzle ORM

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
# Run database migrations
pnpm db:migrate

# Generate database schemas
pnpm db:generate

# Open Drizzle Studio
pnpm db:studio
```

## Architecture

The project follows a monorepo structure using Turborepo for task orchestration and pnpm for package management:

1. **Web Application (apps/web)**:
   - Next.js application with App Router
   - Stytch for authentication and user management
   - Client-side application for user interactions

2. **Documentation (apps/docs)**:
   - Next.js with MDX for API documentation
   - Tailwind CSS for styling
   - Search capabilities with FlexSearch

3. **API Service (packages/api-service)**:
   - Service layer for API interactions
   - Customer and Organization services
   - Stytch utilities for authentication

4. **Business Logic (packages/business)**:
   - Core business logic and domain models
   - Transaction handling

5. **Database Layer (packages/database)**:
   - Drizzle ORM for database access
   - Schema definitions for various entities:
     - Contracts and Contract Line Items
     - Customers and Organizations
     - Revenue Schedules and Journal Entries
     - Performance Obligations
     - Users and authentication

The application follows a layered architecture with separation between UI, business logic, and data access. The database schema suggests a focus on revenue recognition, contract management, and performance obligation tracking.

## Development Notes

- The project uses TypeScript throughout for type safety
- Tailwind CSS is used for styling in the web and docs applications
- Next.js App Router is used for routing in both web apps
- Configuration for various tools is in their respective package directories
- The database schema includes entities for a complete revenue recognition system