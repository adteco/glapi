CREATE TYPE "public"."customer_portal_user_status" AS ENUM('invited', 'active', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."customer_portal_role" AS ENUM('billing_viewer', 'payer', 'billing_admin');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_portal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(255),
	"password_hash" text,
	"status" "customer_portal_user_status" DEFAULT 'invited' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_portal_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"portal_user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" "customer_portal_role" DEFAULT 'billing_viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_portal_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "customer_portal_role" DEFAULT 'billing_viewer' NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"invited_by_entity_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_portal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"portal_user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_portal_password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"portal_user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_users" ADD CONSTRAINT "customer_portal_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_portal_user_id_customer_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."customer_portal_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_invited_by_entity_id_entities_id_fk" FOREIGN KEY ("invited_by_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_sessions" ADD CONSTRAINT "customer_portal_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_sessions" ADD CONSTRAINT "customer_portal_sessions_portal_user_id_customer_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."customer_portal_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_password_resets" ADD CONSTRAINT "customer_portal_password_resets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_portal_password_resets" ADD CONSTRAINT "customer_portal_password_resets_portal_user_id_customer_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."customer_portal_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_portal_users_org_email_idx" ON "customer_portal_users" USING btree ("organization_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_users_org_status_idx" ON "customer_portal_users" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_portal_memberships_org_user_entity_idx" ON "customer_portal_memberships" USING btree ("organization_id","portal_user_id","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_memberships_org_entity_idx" ON "customer_portal_memberships" USING btree ("organization_id","entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_portal_invites_token_hash_idx" ON "customer_portal_invites" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_invites_org_email_idx" ON "customer_portal_invites" USING btree ("organization_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_invites_org_entity_idx" ON "customer_portal_invites" USING btree ("organization_id","entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_portal_sessions_token_hash_idx" ON "customer_portal_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_sessions_org_user_idx" ON "customer_portal_sessions" USING btree ("organization_id","portal_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_portal_password_resets_token_hash_idx" ON "customer_portal_password_resets" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_portal_password_resets_org_user_idx" ON "customer_portal_password_resets" USING btree ("organization_id","portal_user_id");
