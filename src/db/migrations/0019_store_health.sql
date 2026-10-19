ALTER TABLE "suppliers" ADD COLUMN "failing_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_failed_on" date;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "paused_at" timestamp with time zone;