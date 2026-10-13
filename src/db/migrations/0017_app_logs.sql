CREATE TABLE "app_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"area" text NOT NULL,
	"event" text NOT NULL,
	"message" text NOT NULL,
	"user_id" uuid,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_logs" ADD CONSTRAINT "app_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_logs_created_idx" ON "app_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_logs_level_idx" ON "app_logs" USING btree ("level","created_at");--> statement-breakpoint
CREATE INDEX "app_logs_area_idx" ON "app_logs" USING btree ("area","created_at");