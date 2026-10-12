CREATE TABLE IF NOT EXISTS "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"sku" text NOT NULL,
	"platform" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Apparel' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"size_chart_present" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_store_created_idx" ON "listings" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_store_listing_created_idx" ON "listings" ("store_id", "id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_store_sku_idx" ON "listings" ("store_id", "sku");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "listings_store_platform_sku_idx" ON "listings" ("store_id", "platform", "sku");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_images" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"url" text NOT NULL,
	"type" text DEFAULT 'catalog' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"resolution_width" integer,
	"resolution_height" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_store_created_idx" ON "listing_images" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_images_store_listing_created_idx" ON "listing_images" ("store_id", "listing_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"sku" text NOT NULL,
	"platform" text NOT NULL,
	"external_review_id" text,
	"rating" integer NOT NULL,
	"review_text" text NOT NULL,
	"review_date" timestamp with time zone DEFAULT now() NOT NULL,
	"has_photos" boolean DEFAULT false NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_store_created_idx" ON "reviews" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_store_listing_created_idx" ON "reviews" ("store_id", "listing_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_store_sku_idx" ON "reviews" ("store_id", "sku");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_text_hash_idx" ON "reviews" ("store_id", "text_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "return_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"sku" text NOT NULL,
	"platform" text NOT NULL,
	"order_id" text,
	"reported_reason" text NOT NULL,
	"customer_comment" text DEFAULT '' NOT NULL,
	"text_hash" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "return_reasons_store_created_idx" ON "return_reasons" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "return_reasons_store_listing_created_idx" ON "return_reasons" ("store_id", "listing_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "return_reasons_store_sku_idx" ON "return_reasons" ("store_id", "sku");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"review_id" text,
	"return_reason_id" text,
	"source_type" text NOT NULL,
	"sentiment" text NOT NULL,
	"aspects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cause_label" text NOT NULL,
	"confidence" numeric DEFAULT '0.85' NOT NULL,
	"analyzer_type" text NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_analysis_store_created_idx" ON "review_analysis" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_analysis_store_listing_created_idx" ON "review_analysis" ("store_id", "listing_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_analysis_store_cause_idx" ON "review_analysis" ("store_id", "cause_label");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_analysis_hash_idx" ON "review_analysis" ("store_id", "text_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"issue_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"evidence_text" text NOT NULL,
	"confidence" numeric DEFAULT '0.85' NOT NULL,
	"suggested_action" text NOT NULL,
	"is_human_reviewed" boolean DEFAULT false NOT NULL,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_issues_store_created_idx" ON "listing_issues" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_issues_store_listing_created_idx" ON "listing_issues" ("store_id", "listing_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_issues_store_status_idx" ON "listing_issues" ("store_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"accuracy_score" integer NOT NULL,
	"listing_caused_return_count" integer DEFAULT 0 NOT NULL,
	"total_reviews_count" integer DEFAULT 0 NOT NULL,
	"total_returns_count" integer DEFAULT 0 NOT NULL,
	"estimated_loss" integer DEFAULT 0 NOT NULL,
	"estimated_saving" integer DEFAULT 0 NOT NULL,
	"dominant_issue" text,
	"risk_modifier" integer DEFAULT 0 NOT NULL,
	"assumptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_scores_store_created_idx" ON "listing_scores" ("store_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_scores_store_listing_created_idx" ON "listing_scores" ("store_id", "listing_id", "created_at");
