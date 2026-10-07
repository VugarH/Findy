CREATE TABLE "order_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"market_code" text NOT NULL,
	"user_id" uuid,
	"product_id" uuid,
	"offer_id" uuid,
	"product_title" text NOT NULL,
	"supplier_name" text NOT NULL,
	"offer_url" text NOT NULL,
	"quantity" integer NOT NULL,
	"estimated_landed_minor" integer NOT NULL,
	"estimated_fee_minor" integer NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"city" text NOT NULL,
	"note" text,
	"locale" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_requests_reference_idx" ON "order_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "order_requests_user_idx" ON "order_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_requests_status_idx" ON "order_requests" USING btree ("status","created_at");