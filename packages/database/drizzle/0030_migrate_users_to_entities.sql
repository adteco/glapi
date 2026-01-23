-- Migration: Migrate user data to entities table
-- Purpose: Create entity records for existing users and establish mapping table for FK migration

-- Phase 2.1: Create mapping table for transition period
-- This allows us to gradually migrate FKs without losing referential integrity
CREATE TABLE IF NOT EXISTS user_entity_mapping (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT user_entity_mapping_entity_unique UNIQUE (entity_id)
);

COMMENT ON TABLE user_entity_mapping IS 'Temporary mapping table for user-to-entity migration. Drop after FK migration is complete.';

-- Phase 2.2: Create entity records for existing users
-- This inserts new entities for users that don't already have a matching entity by clerk_user_id
INSERT INTO entities (
  id,
  organization_id,
  name,
  display_name,
  entity_types,
  email,
  clerk_user_id,
  role,
  settings,
  is_active,
  last_login,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.organization_id::text,
  COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email),
  COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), NULL),
  ARRAY['Employee']::text[],
  u.email,
  u.stytch_user_id,
  u.role,
  u.settings,
  COALESCE(u.is_active, true),
  u.last_login,
  CASE WHEN COALESCE(u.is_active, true) THEN 'active' ELSE 'inactive' END,
  jsonb_build_object(
    'migratedFromUserId', u.id::text,
    'migratedAt', NOW()::text,
    'migrationSource', 'users_consolidation'
  ),
  u.created_at,
  u.updated_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM entities e WHERE e.clerk_user_id = u.stytch_user_id
);

-- Phase 2.3: Populate mapping table
-- Map each user to their corresponding entity (by clerk_user_id match)
INSERT INTO user_entity_mapping (user_id, entity_id)
SELECT u.id, e.id
FROM users u
JOIN entities e ON e.clerk_user_id = u.stytch_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_entity_mapping m WHERE m.user_id = u.id
);

-- Verification queries (to be run manually to confirm migration success)
-- Count of users vs mapped entities (should match):
-- SELECT
--   (SELECT COUNT(*) FROM users) as user_count,
--   (SELECT COUNT(*) FROM user_entity_mapping) as mapping_count;

-- Unmapped users (should be 0):
-- SELECT * FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_entity_mapping m WHERE m.user_id = u.id);

-- Entities created from users:
-- SELECT COUNT(*) FROM entities WHERE metadata->>'migrationSource' = 'users_consolidation';
