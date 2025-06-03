# Database Package Architecture

## Overview
This package provides a centralized database access layer using PostgreSQL and Drizzle ORM. It serves as the single source of truth for database schema definitions and connections across the entire application.

## Key Design Decisions

### PostgreSQL with Drizzle ORM
- Using PostgreSQL as the primary database
- Drizzle ORM for type-safe database operations
- Direct connection strategy (no connection pooling middleware)
- Hosted on Vercel Postgres

### Package Structure

packages/database/
├── src/
│   └── db/
│       └── schema.ts    # Database schema definitions
├── migrations/         # Generated SQL migrations
├── index.ts           # Public API exports
└── drizzle.config.ts  # Drizzle configuration


### Schema Design Principles
- Use PostgreSQL-native data types
- Enforce constraints at database level
- Include timestamps for all tables
- Use snake_case for database naming

### Type Safety
- All schemas generate TypeScript types
- Exports are fully typed for consuming applications
- No raw SQL queries without type safety

### Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string

## Usage
This package should be imported by other packages/apps that need database access:

typescript
import { db, projects } from '@kurrent/database'

## Row-Level Security Architecture

The system implements row-level security (RLS) through application-level enforcement:

1. **Organization Isolation**: Every major table has an `organization_id` column that links records to a specific organization
2. **Authentication**: Clerk provides the authenticated user's organization ID in the JWT token
3. **Repository Pattern**: All repository methods require and filter by `organization_id` to ensure data isolation
4. **Service Layer**: Services validate that the organization context matches before any operations
5. **No Direct Database Access**: All queries go through the repository layer which enforces organization filtering

This ensures complete data isolation between organizations - users can only see and modify data belonging to their organization.

## Future Considerations
- Connection pooling configuration
- Read replicas support
- Migration automation
- Backup strategies
- Database-level RLS policies (as an additional security layer)