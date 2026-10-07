CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "subcategory_slug" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "origin_country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subcategory_slug" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_type" text;--> statement-breakpoint
CREATE INDEX "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);