-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "hypothesis" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "primary_metric" VARCHAR(30) NOT NULL,
    "confidence_level" DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    "min_sample_size" INTEGER NOT NULL DEFAULT 100,
    "winner_id" UUID,
    "significance" DECIMAL(6,4),
    "config" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "experiment_id" UUID NOT NULL,
    "content_id" UUID,
    "label" VARCHAR(255) NOT NULL,
    "traffic_percent" INTEGER NOT NULL DEFAULT 50,
    "preset_overrides" JSONB NOT NULL DEFAULT '{}',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "completion_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "share_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "viral_score" INTEGER,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experiments_tenant_id_idx" ON "experiments"("tenant_id");

-- CreateIndex
CREATE INDEX "experiment_variants_experiment_id_idx" ON "experiment_variants"("experiment_id");

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
