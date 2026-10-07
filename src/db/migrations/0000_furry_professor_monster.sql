CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_code" text NOT NULL,
	"product_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"scope" text NOT NULL,
	"landed_minor" integer NOT NULL,
	"usual_landed_minor" integer NOT NULL,
	"savings_minor" integer NOT NULL,
	"breakdown" jsonb NOT NULL,
	"real_discount_pct" real NOT NULL,
	"claimed_discount_pct" real,
	"best_local_landed_minor" integer,
	"best_global_landed_minor" integer,
	"offer_count" integer NOT NULL,
	"delivery_min_days" integer NOT NULL,
	"delivery_max_days" integer NOT NULL,
	"score" integer NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"list_price_minor" integer,
	"shipping_minor" integer,
	"in_stock" boolean DEFAULT true NOT NULL,
	"delivery_min_days" integer,
	"delivery_max_days" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"market_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_code" text NOT NULL,
	"status" text NOT NULL,
	"stats" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"offer_id" uuid NOT NULL,
	"observed_on" date NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	CONSTRAINT "price_observations_offer_id_observed_on_pk" PRIMARY KEY("offer_id","observed_on")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"model" text,
	"gtin" text,
	"model_key" text,
	"category_slug" text NOT NULL,
	"image_url" text,
	"weight_kg" real,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"market_code" text NOT NULL,
	"query" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"live_count" integer DEFAULT 0 NOT NULL,
	"last_result_count" integer DEFAULT 0 NOT NULL,
	"last_searched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_queries_market_code_query_pk" PRIMARY KEY("market_code","query")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"origin_country" text NOT NULL,
	"currency" text NOT NULL,
	"website_url" text NOT NULL,
	"trust_score" integer NOT NULL,
	"integration" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_market_score_idx" ON "deals" USING btree ("market_code","score");--> statement-breakpoint
CREATE INDEX "deals_market_category_idx" ON "deals" USING btree ("market_code","category_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_supplier_external_idx" ON "offers" USING btree ("supplier_id","external_id");--> statement-breakpoint
CREATE INDEX "offers_product_idx" ON "offers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "outbound_clicks_offer_idx" ON "outbound_clicks" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_gtin_idx" ON "products" USING btree ("gtin");--> statement-breakpoint
CREATE INDEX "products_model_key_idx" ON "products" USING btree ("model_key");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_slug");