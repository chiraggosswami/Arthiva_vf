CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "recommended_courier" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "courier_comparison" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "shopify_shared_secret" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "woocommerce_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_events_store_created_idx" ON "webhook_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_store_status_idx" ON "webhook_events" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_idx" ON "webhook_events" USING btree ("store_id","source","external_id","event_type");