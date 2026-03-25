-- CreateTable
CREATE TABLE "suggestion_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "channel_id" UUID,
    "content_id" UUID,
    "preset_id" VARCHAR(100) NOT NULL,
    "dimension" VARCHAR(30) NOT NULL,
    "reason" TEXT NOT NULL,
    "expected_improvement" VARCHAR(20) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL DEFAULT 'shown',
    "viral_score_before" INTEGER,
    "viral_score_after" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suggestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suggestion_logs_tenant_id_idx" ON "suggestion_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "suggestion_logs_channel_id_idx" ON "suggestion_logs"("channel_id");

-- CreateIndex
CREATE INDEX "suggestion_logs_preset_id_idx" ON "suggestion_logs"("preset_id");

-- AddForeignKey
ALTER TABLE "suggestion_logs" ADD CONSTRAINT "suggestion_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_logs" ADD CONSTRAINT "suggestion_logs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_logs" ADD CONSTRAINT "suggestion_logs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
