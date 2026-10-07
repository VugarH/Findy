CREATE TABLE "fx_rates" (
	"market_code" text NOT NULL,
	"currency" text NOT NULL,
	"rate" real NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_market_code_currency_pk" PRIMARY KEY("market_code","currency")
);
