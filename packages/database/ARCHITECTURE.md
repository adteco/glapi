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

## Future Considerations
- Connection pooling configuration
- Read replicas support
- Migration automation
- Backup strategies