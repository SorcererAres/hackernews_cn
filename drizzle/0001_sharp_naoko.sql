DROP INDEX "translation_jobs_queue_idx";--> statement-breakpoint
ALTER TABLE "translation_jobs" ADD COLUMN "next_run_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "translation_jobs_queue_idx" ON "translation_jobs" USING btree ("status","next_run_at","priority","created_at");