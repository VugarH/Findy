ALTER TABLE "deals" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "access_method" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "first_verified_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_success_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_offer_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_error_at" timestamp with time zone;