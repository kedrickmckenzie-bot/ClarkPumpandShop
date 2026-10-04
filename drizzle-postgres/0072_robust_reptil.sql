ALTER TABLE "ops_stores" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "ops_stores" ADD COLUMN "access_notes" text;--> statement-breakpoint
ALTER TABLE "ops_stores" ADD COLUMN "access_notes_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_users" ADD COLUMN "phone" text;