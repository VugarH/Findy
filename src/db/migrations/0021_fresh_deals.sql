CREATE TABLE "fresh_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_code" text NOT NULL,
	"product_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"drop_pct" integer NOT NULL,
	"from_landed_minor" integer NOT NULL,
	"from_on" date NOT NULL,
	"store_discount_pct" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fresh_deals" ADD CONSTRAINT "fresh_deals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fresh_deals" ADD CONSTRAINT "fresh_deals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fresh_deals_market_product_idx" ON "fresh_deals" USING btree ("market_code","product_id");--> statement-breakpoint
CREATE INDEX "fresh_deals_market_drop_idx" ON "fresh_deals" USING btree ("market_code","drop_pct");