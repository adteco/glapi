-- Manually established baseline after introspection.
-- Database schema is assumed to match the Drizzle schema files.
-- This migration primarily ensures the __drizzle_migrations table is created and this baseline is recorded.
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
);