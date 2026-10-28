CREATE TABLE "search_terms" (
	"market_code" text NOT NULL,
	"kind" text NOT NULL,
	"folded" text NOT NULL,
	"label" text NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "search_terms_market_code_kind_folded_pk" PRIMARY KEY("market_code","kind","folded")
);
--> statement-breakpoint
CREATE INDEX "search_terms_folded_trgm_idx" ON "search_terms" USING gin ("folded" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_terms_prefix_idx" ON "search_terms" USING btree ("market_code","folded" text_pattern_ops);