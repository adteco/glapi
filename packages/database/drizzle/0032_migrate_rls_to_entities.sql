-- Migration: Migrate RLS tables from users to entities
-- Purpose: Rename user_roles to entity_roles and user_subsidiary_access to entity_subsidiary_access
-- Prerequisites: Run 0030_migrate_users_to_entities.sql first

-- ============================================================================
-- PHASE 1: Create new entity-based RLS tables
-- ============================================================================

-- Create entity_roles table
CREATE TABLE IF NOT EXISTS entity_roles (
  entity_id UUID NOT NULL REFERENCES entities(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  subsidiary_id UUID REFERENCES subsidiaries(id),
  granted_by UUID REFERENCES entities(id),
  granted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_date TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (entity_id, role_id, COALESCE(subsidiary_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- Create indexes for entity_roles
CREATE INDEX IF NOT EXISTS idx_entity_roles_entity ON entity_roles(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_roles_role ON entity_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_entity_roles_subsidiary ON entity_roles(subsidiary_id);

-- Create entity_subsidiary_access table
CREATE TABLE IF NOT EXISTS entity_subsidiary_access (
  entity_id UUID NOT NULL REFERENCES entities(id),
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),
  access_level TEXT DEFAULT 'read' NOT NULL,
  granted_by UUID REFERENCES entities(id),
  granted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_date TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (entity_id, subsidiary_id)
);

-- Create indexes for entity_subsidiary_access
CREATE INDEX IF NOT EXISTS idx_entity_subsidiary_access_entity ON entity_subsidiary_access(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_subsidiary_access_subsidiary ON entity_subsidiary_access(subsidiary_id);

-- ============================================================================
-- PHASE 2: Migrate data from user_roles to entity_roles
-- ============================================================================

INSERT INTO entity_roles (entity_id, role_id, subsidiary_id, granted_by, granted_date, expires_date)
SELECT
  m.entity_id,
  ur.role_id,
  ur.subsidiary_id,
  gm.entity_id,
  ur.granted_date,
  ur.expires_date
FROM user_roles ur
JOIN user_entity_mapping m ON m.user_id = ur.user_id
LEFT JOIN user_entity_mapping gm ON gm.user_id = ur.granted_by
WHERE NOT EXISTS (
  SELECT 1 FROM entity_roles er
  WHERE er.entity_id = m.entity_id
    AND er.role_id = ur.role_id
    AND COALESCE(er.subsidiary_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(ur.subsidiary_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ============================================================================
-- PHASE 3: Migrate data from user_subsidiary_access to entity_subsidiary_access
-- ============================================================================

INSERT INTO entity_subsidiary_access (entity_id, subsidiary_id, access_level, granted_by, granted_date, expires_date)
SELECT
  m.entity_id,
  usa.subsidiary_id,
  usa.access_level,
  gm.entity_id,
  usa.granted_date,
  usa.expires_date
FROM user_subsidiary_access usa
JOIN user_entity_mapping m ON m.user_id = usa.user_id
LEFT JOIN user_entity_mapping gm ON gm.user_id = usa.granted_by
WHERE NOT EXISTS (
  SELECT 1 FROM entity_subsidiary_access esa
  WHERE esa.entity_id = m.entity_id
    AND esa.subsidiary_id = usa.subsidiary_id
);

-- ============================================================================
-- PHASE 4: Create views for backward compatibility (optional)
-- ============================================================================

-- Create view that provides backward-compatible access to user_roles
-- This allows existing code to continue working during transition
CREATE OR REPLACE VIEW user_roles_v AS
SELECT
  e.id as user_id,
  er.role_id,
  er.subsidiary_id,
  er.granted_by,
  er.granted_date,
  er.expires_date
FROM entity_roles er
JOIN entities e ON e.id = er.entity_id
WHERE e.clerk_user_id IS NOT NULL;

-- Create view that provides backward-compatible access to user_subsidiary_access
CREATE OR REPLACE VIEW user_subsidiary_access_v AS
SELECT
  e.id as user_id,
  esa.subsidiary_id,
  esa.access_level,
  esa.granted_by,
  esa.granted_date,
  esa.expires_date
FROM entity_subsidiary_access esa
JOIN entities e ON e.id = esa.entity_id
WHERE e.clerk_user_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE entity_roles IS 'Role assignments for entities. Authenticated users are entities with clerk_user_id set.';
COMMENT ON TABLE entity_subsidiary_access IS 'Subsidiary access permissions for entities. Authenticated users are entities with clerk_user_id set.';
COMMENT ON VIEW user_roles_v IS 'Backward-compatible view for user_roles. Maps to entity_roles for authenticated entities.';
COMMENT ON VIEW user_subsidiary_access_v IS 'Backward-compatible view for user_subsidiary_access. Maps to entity_subsidiary_access for authenticated entities.';

-- ============================================================================
-- VERIFICATION QUERIES (run manually)
-- ============================================================================

-- Count comparison (should match after migration)
-- SELECT 'user_roles' as table_name, COUNT(*) as count FROM user_roles
-- UNION ALL SELECT 'entity_roles', COUNT(*) FROM entity_roles;

-- SELECT 'user_subsidiary_access' as table_name, COUNT(*) as count FROM user_subsidiary_access
-- UNION ALL SELECT 'entity_subsidiary_access', COUNT(*) FROM entity_subsidiary_access;

-- ============================================================================
-- NOTE: The old user_roles and user_subsidiary_access tables should be dropped
-- in a later migration after all code has been updated to use entity_* tables.
-- See migration 0033_cleanup_users_consolidation.sql for cleanup.
-- ============================================================================
