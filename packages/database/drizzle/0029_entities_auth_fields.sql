-- Migration: Add auth fields to entities table
-- Purpose: Enable entities (specifically Employee entities) to serve as authenticated users,
--          consolidating users and entities into a single table.

-- Phase 1: Add auth columns to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS settings JSONB;

-- Create index for Clerk user ID lookups (partial index since most entities won't have this)
CREATE INDEX IF NOT EXISTS entities_clerk_user_id_idx ON entities(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN entities.clerk_user_id IS 'Clerk external user ID for authentication. Only set for entities that can log in (typically Employees).';
COMMENT ON COLUMN entities.role IS 'Authorization role: user, admin, owner, etc. Only relevant for authenticated entities.';
COMMENT ON COLUMN entities.last_login IS 'Timestamp of last successful login. Only relevant for authenticated entities.';
COMMENT ON COLUMN entities.settings IS 'User-specific settings (UI preferences, etc.). Only relevant for authenticated entities.';
