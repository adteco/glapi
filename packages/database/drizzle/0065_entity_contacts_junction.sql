-- Create entity_contacts junction table for many-to-many relationships
-- This allows contacts to be associated with multiple entities (companies/leads/customers)

CREATE TABLE IF NOT EXISTS "entity_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
  "role" text,  -- 'Primary', 'Billing', 'Technical', 'Sales', etc.
  "is_primary" boolean NOT NULL DEFAULT false,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "entity_contacts_unique" UNIQUE ("entity_id", "contact_id")
);

-- Indexes for performance
CREATE INDEX "entity_contacts_entity_idx" ON "entity_contacts" ("entity_id");
CREATE INDEX "entity_contacts_contact_idx" ON "entity_contacts" ("contact_id");
CREATE INDEX "entity_contacts_org_idx" ON "entity_contacts" ("organization_id");

-- Enable RLS
ALTER TABLE "entity_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_contacts" FORCE ROW LEVEL SECURITY;

-- RLS Policies (organization isolation)
CREATE POLICY "org_isolation_select_entity_contacts" ON "entity_contacts"
  FOR SELECT USING (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_insert_entity_contacts" ON "entity_contacts"
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_update_entity_contacts" ON "entity_contacts"
  FOR UPDATE USING (organization_id::text = current_setting('app.current_organization_id', true))
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true));

CREATE POLICY "org_isolation_delete_entity_contacts" ON "entity_contacts"
  FOR DELETE USING (organization_id::text = current_setting('app.current_organization_id', true));
