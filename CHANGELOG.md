# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - January 2026

### Added
- PostgreSQL Row-Level Security (RLS) policies for all multi-tenant tables
- RLS context verification in tRPC middleware to ensure security context is established
- Comprehensive RLS documentation in database ARCHITECTURE.md

### Changed
- Workflows router now uses contextual database connection (`ctx.db`) for all queries
- Helper functions in workflows router accept explicit db parameter for RLS compliance
- Updated database context module with cleaner implementation

### Fixed
- Fixed "Failed to establish organization security context" error in workflows operations
- Fixed RLS policy violations on INSERT/UPDATE/DELETE operations
- Resolved workflows router bypassing RLS by using global db instead of ctx.db

### Security
- All multi-tenant tables now enforce RLS with FORCE ROW LEVEL SECURITY
- Organization isolation is now enforced at database level (defense in depth)
- Added explicit documentation that RLS must never be disabled on multi-tenant tables

## [1.2.0] - December 2024

### Added
- MCP server integration for enhanced AI capabilities
- New SSPML Training Service for machine learning workflows
- Comprehensive API documentation with OpenAPI support

### Changed
- Improved TypeScript build process and type safety
- Enhanced error handling across all services

### Fixed
- Resolved MCP server TypeScript build errors
- Fixed SSPMLTrainingService wrapper implementation

## [1.1.0] - November 2024

### Added
- Revenue recognition dashboard with real-time metrics
- Contract management system for performance obligations
- Accounting dimensions API (customers, organizations, subsidiaries)

### Changed
- Streamlined authentication flow with Clerk integration
- Enhanced data validation with Zod schemas

### Fixed
- Fixed database migration scripts for PostgreSQL
- Resolved API endpoint routing issues

## [1.0.0] - October 2024

### Added
- Initial release of GLAPI platform
- Core accounting dimensions: classes, departments, locations
- Express.js REST API with authentication middleware
- Next.js web application with shadcn/ui components
- Drizzle ORM integration with PostgreSQL

### Changed
- Monorepo structure with Turborepo for optimal builds
