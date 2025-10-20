-- Projects core tables
CREATE TABLE "projects" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid,
    "project_code" text NOT NULL,
    "name" text NOT NULL,
    "status" text NOT NULL DEFAULT 'planning',
    "start_date" date,
    "end_date" date,
    "external_source" text,
    "job_number" text,
    "project_type" text,
    "retainage_percent" numeric(5, 2) NOT NULL DEFAULT '0',
    "currency_code" text,
    "description" text,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
    CONSTRAINT "projects_subsidiary_id_subsidiaries_id_fk" FOREIGN KEY ("subsidiary_id") REFERENCES "subsidiaries"("id")
);

CREATE UNIQUE INDEX "idx_projects_org_code" ON "projects" USING btree ("organization_id", "project_code");

CREATE TABLE "project_participants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" uuid NOT NULL,
    "entity_id" uuid,
    "participant_role" text NOT NULL,
    "is_primary" boolean NOT NULL DEFAULT false,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "project_participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    CONSTRAINT "project_participants_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
);

CREATE UNIQUE INDEX "idx_project_participants_role" ON "project_participants" USING btree ("project_id", "participant_role", "entity_id");

CREATE TABLE "project_cost_codes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" uuid NOT NULL,
    "activity_code_id" uuid,
    "cost_code" text,
    "cost_type" text,
    "description" text,
    "is_active" boolean NOT NULL DEFAULT true,
    "budget_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "committed_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "project_cost_codes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    CONSTRAINT "project_cost_codes_activity_code_id_activity_codes_id_fk" FOREIGN KEY ("activity_code_id") REFERENCES "activity_codes"("id")
);

CREATE UNIQUE INDEX "idx_project_cost_codes_project_code" ON "project_cost_codes" USING btree ("project_id", "cost_code");

CREATE TABLE "project_budget_versions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" uuid NOT NULL,
    "version_name" text NOT NULL,
    "status" text NOT NULL DEFAULT 'draft',
    "is_locked" boolean NOT NULL DEFAULT false,
    "effective_date" date,
    "notes" text,
    "created_by" uuid,
    "approved_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "project_budget_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    CONSTRAINT "project_budget_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id"),
    CONSTRAINT "project_budget_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id")
);

CREATE UNIQUE INDEX "idx_project_budget_versions_name" ON "project_budget_versions" USING btree ("project_id", "version_name");

CREATE TABLE "project_budget_lines" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "budget_version_id" uuid NOT NULL,
    "project_cost_code_id" uuid NOT NULL,
    "cost_type" text,
    "original_budget_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "revised_budget_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "forecast_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "committed_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "actual_amount" numeric(18, 4) NOT NULL DEFAULT '0',
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "project_budget_lines_budget_version_id_project_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "project_budget_versions"("id"),
    CONSTRAINT "project_budget_lines_project_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("project_cost_code_id") REFERENCES "project_cost_codes"("id")
);

CREATE UNIQUE INDEX "idx_project_budget_lines_unique" ON "project_budget_lines" USING btree ("budget_version_id", "project_cost_code_id");

CREATE TABLE "external_references" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid,
    "object_type" text NOT NULL,
    "object_id" uuid NOT NULL,
    "provider" text NOT NULL,
    "external_id" text NOT NULL,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "external_references_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
);

CREATE UNIQUE INDEX "idx_external_refs_provider_external" ON "external_references" USING btree ("provider", "external_id");
CREATE INDEX "idx_external_refs_object" ON "external_references" USING btree ("object_type", "object_id");

-- Extend business_transactions for construction workflows
ALTER TABLE "business_transactions" ADD COLUMN "external_source" text;
ALTER TABLE "business_transactions" ADD COLUMN "workflow_payload" jsonb;
ALTER TABLE "business_transactions" ADD COLUMN "retainage_percent" numeric(5, 2);
ALTER TABLE "business_transactions" ADD COLUMN "retainage_released_percent" numeric(5, 2);
ALTER TABLE "business_transactions" ADD COLUMN "period_start_date" date;
ALTER TABLE "business_transactions" ADD COLUMN "period_end_date" date;
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id");

-- Extend business_transaction_lines with schedule/retainage metrics
ALTER TABLE "business_transaction_lines" ADD COLUMN "schedule_value" numeric(18, 4) NOT NULL DEFAULT '0';
ALTER TABLE "business_transaction_lines" ADD COLUMN "work_completed_to_date" numeric(18, 4) NOT NULL DEFAULT '0';
ALTER TABLE "business_transaction_lines" ADD COLUMN "retainage_percent" numeric(5, 2);
ALTER TABLE "business_transaction_lines" ADD COLUMN "retainage_amount" numeric(18, 4) NOT NULL DEFAULT '0';
ALTER TABLE "business_transaction_lines" ADD COLUMN "stored_material_amount" numeric(18, 4) NOT NULL DEFAULT '0';
ALTER TABLE "business_transaction_lines" ADD CONSTRAINT "business_transaction_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id");
