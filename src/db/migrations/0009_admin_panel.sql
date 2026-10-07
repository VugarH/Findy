CREATE TABLE "admin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_label" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"needs_publish" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "locked_fields" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "source" text DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "custom_config" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_events" ADD CONSTRAINT "admin_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_events_created_idx" ON "admin_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_events_entity_idx" ON "admin_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merged_into_id_products_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;