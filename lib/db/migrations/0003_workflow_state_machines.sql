ALTER TABLE "ndr_cases" ADD COLUMN "workflow_step" text DEFAULT 'INITIAL_OUTREACH' NOT NULL;--> statement-breakpoint
ALTER TABLE "ndr_cases" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ndr_cases" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ndr_cases" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ndr_cases" ADD COLUMN "customer_response" jsonb;--> statement-breakpoint
ALTER TABLE "ndr_cases" ADD COLUMN "payment_link_id" text;--> statement-breakpoint
ALTER TABLE "rto_cases" ADD COLUMN "root_cause" text;--> statement-breakpoint
ALTER TABLE "rto_cases" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "rto_cases" ADD COLUMN "options_evaluated" jsonb;
