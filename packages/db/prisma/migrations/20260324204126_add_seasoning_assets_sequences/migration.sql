-- AlterTable
ALTER TABLE "user_presets" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "seasoning_cohorts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schedule_config" JSONB NOT NULL DEFAULT '{}',
    "proxy_config" JSONB NOT NULL DEFAULT '{}',
    "total_accounts" INTEGER NOT NULL DEFAULT 0,
    "completed_accounts" INTEGER NOT NULL DEFAULT 0,
    "failed_accounts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasoning_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasoning_enrollments" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "email_account_id" UUID NOT NULL,
    "social_account_id" UUID,
    "platform" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "current_phase" VARCHAR(20),
    "phase_started_at" TIMESTAMPTZ,
    "proxy_server" VARCHAR(255),
    "fingerprint_id" VARCHAR(100),
    "activities_completed" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMPTZ,
    "next_scheduled_at" TIMESTAMPTZ,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "activity_log" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasoning_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_registry_entries" (
    "id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "hash" VARCHAR(128),
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_asset_id" UUID,
    "generated_by" VARCHAR(50),
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "content_id" UUID,
    "shot_id" UUID,
    "sequence_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_registry_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_items" (
    "sequence_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "sequence_items_pkey" PRIMARY KEY ("sequence_id","content_id")
);

-- CreateIndex
CREATE INDEX "seasoning_cohorts_tenant_id_idx" ON "seasoning_cohorts"("tenant_id");

-- CreateIndex
CREATE INDEX "seasoning_cohorts_status_idx" ON "seasoning_cohorts"("status");

-- CreateIndex
CREATE INDEX "seasoning_enrollments_status_idx" ON "seasoning_enrollments"("status");

-- CreateIndex
CREATE INDEX "seasoning_enrollments_next_scheduled_at_idx" ON "seasoning_enrollments"("next_scheduled_at");

-- CreateIndex
CREATE INDEX "seasoning_enrollments_cohort_id_idx" ON "seasoning_enrollments"("cohort_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasoning_enrollments_cohort_id_email_account_id_platform_key" ON "seasoning_enrollments"("cohort_id", "email_account_id", "platform");

-- CreateIndex
CREATE INDEX "asset_registry_entries_content_id_idx" ON "asset_registry_entries"("content_id");

-- CreateIndex
CREATE INDEX "asset_registry_entries_shot_id_idx" ON "asset_registry_entries"("shot_id");

-- CreateIndex
CREATE INDEX "asset_registry_entries_type_idx" ON "asset_registry_entries"("type");

-- CreateIndex
CREATE INDEX "asset_registry_entries_storage_key_idx" ON "asset_registry_entries"("storage_key");

-- CreateIndex
CREATE INDEX "sequences_channel_id_idx" ON "sequences"("channel_id");

-- CreateIndex
CREATE INDEX "sequence_items_sequence_id_position_idx" ON "sequence_items"("sequence_id", "position");

-- AddForeignKey
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_products" ADD CONSTRAINT "storefront_products_affiliate_product_id_fkey" FOREIGN KEY ("affiliate_product_id") REFERENCES "affiliate_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasoning_cohorts" ADD CONSTRAINT "seasoning_cohorts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasoning_enrollments" ADD CONSTRAINT "seasoning_enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "seasoning_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasoning_enrollments" ADD CONSTRAINT "seasoning_enrollments_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasoning_enrollments" ADD CONSTRAINT "seasoning_enrollments_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_shot_id_fkey" FOREIGN KEY ("shot_id") REFERENCES "storyboard_shots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "asset_registry_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_items" ADD CONSTRAINT "sequence_items_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_items" ADD CONSTRAINT "sequence_items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
