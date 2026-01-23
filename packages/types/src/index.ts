/**
 * @glapi/types - Centralized type definitions for GLAPI
 *
 * This package provides shared TypeScript types and Zod schemas
 * used across the GLAPI monorepo. It serves as the single source
 * of truth for type definitions, eliminating duplication between
 * packages/trpc and packages/api-service.
 *
 * @packageDocumentation
 */

// Re-export all type modules
export * from './common';
export * from './entities';
export * from './accounting';
export * from './items';
export * from './revenue';
export * from './time-tracking';
export * from './transactions';
export * from './integrations';
export * from './project-tasks';
