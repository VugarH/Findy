CREATE TABLE "daily_stats" (
	"day" date PRIMARY KEY NOT NULL,
	"visitors" integer NOT NULL,
	"signed_in_users" integer NOT NULL,
	"page_views" integer NOT NULL,
	"store_clicks" integer NOT NULL,
	"searches" integer NOT NULL,
	"signups" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"visitor_id" text NOT NULL,
	"user_id" uuid,
	"path" text,
	"source" text,
	"device" text,
	"locale" text,
	"query" text,
	"result_count" integer
);
--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_events_created_idx" ON "site_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "site_events_type_idx" ON "site_events" USING btree ("type","created_at");--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_clicks_created_idx" ON "outbound_clicks" USING btree ("created_at");