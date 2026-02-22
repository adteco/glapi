CREATE TYPE "public"."external_event_processing_status" AS ENUM('received', 'processed', 'ignored', 'failed');

CREATE TABLE IF NOT EXISTS "external_event_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(64) NOT NULL,
	"external_event_id" varchar(255) NOT NULL,
	"organization_id" uuid,
	"event_type" varchar(255) NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"processing_status" "external_event_processing_status" DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"payload" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_event_receipts" ADD CONSTRAINT "external_event_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_event_receipts_provider_event_id_idx" ON "external_event_receipts" USING btree ("provider","external_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_event_receipts_organization_id_idx" ON "external_event_receipts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_event_receipts_processing_status_idx" ON "external_event_receipts" USING btree ("processing_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_event_receipts_received_at_idx" ON "external_event_receipts" USING btree ("received_at");
