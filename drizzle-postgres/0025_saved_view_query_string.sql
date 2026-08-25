ALTER TABLE "ops_saved_views" ALTER COLUMN "query_json" TYPE text USING "query_json"::text;--> statement-breakpoint
ALTER TABLE "ops_saved_views" RENAME COLUMN "query_json" TO "query_string";