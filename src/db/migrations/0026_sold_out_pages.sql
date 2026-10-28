CREATE TABLE "sold_out_pages" (
	"supplier_id" text NOT NULL,
	"url" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sold_out_pages_supplier_id_url_pk" PRIMARY KEY("supplier_id","url")
);
--> statement-breakpoint
ALTER TABLE "sold_out_pages" ADD CONSTRAINT "sold_out_pages_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;