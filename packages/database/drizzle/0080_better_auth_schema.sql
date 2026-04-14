-- Better Auth schema rollout
-- Adds Better Auth bridge columns to internal tables and creates the auth tables
-- expected by packages/auth and the reconciliation tooling.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS better_auth_org_id varchar(100);

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS better_auth_user_id text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS better_auth_user_id varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_better_auth_org_id_unique
  ON organizations (better_auth_org_id)
  WHERE better_auth_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organizations_better_auth_org_id_idx
  ON organizations (better_auth_org_id);

CREATE UNIQUE INDEX IF NOT EXISTS entities_better_auth_user_id_unique
  ON entities (better_auth_user_id)
  WHERE better_auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS entities_better_auth_user_id_idx
  ON entities (better_auth_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS users_better_auth_user_id_unique
  ON users (better_auth_user_id)
  WHERE better_auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique
  ON "user" ("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL,
  "activeOrganizationId" text
);

CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique
  ON "session" ("token");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text,
  "logo" text,
  "createdAt" timestamp NOT NULL,
  "metadata" text
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_slug_unique
  ON "organization" ("slug");

CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY,
  "organizationId" text NOT NULL,
  "userId" text NOT NULL,
  "role" text NOT NULL,
  "createdAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY,
  "organizationId" text NOT NULL,
  "email" text NOT NULL,
  "role" text,
  "status" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "inviterId" text NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "session"
    ADD CONSTRAINT "session_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "account"
    ADD CONSTRAINT "account_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "member"
    ADD CONSTRAINT "member_organizationId_organization_id_fk"
    FOREIGN KEY ("organizationId")
    REFERENCES "public"."organization"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "member"
    ADD CONSTRAINT "member_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "invitation"
    ADD CONSTRAINT "invitation_organizationId_organization_id_fk"
    FOREIGN KEY ("organizationId")
    REFERENCES "public"."organization"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "invitation"
    ADD CONSTRAINT "invitation_inviterId_user_id_fk"
    FOREIGN KEY ("inviterId")
    REFERENCES "public"."user"("id")
    ON DELETE no action
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

COMMENT ON COLUMN organizations.better_auth_org_id IS 'Better Auth organization ID bridge used during auth migration.';
COMMENT ON COLUMN entities.better_auth_user_id IS 'Better Auth user ID bridge used during auth migration.';
COMMENT ON COLUMN users.better_auth_user_id IS 'Better Auth user ID bridge retained for legacy user records.';
