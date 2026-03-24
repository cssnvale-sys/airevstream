-- CreateTable
CREATE TABLE "user_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preset_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "family" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "tier" VARCHAR(20),
    "ranges" JSONB,
    "source" VARCHAR(20) NOT NULL DEFAULT 'ai',
    "ai_prompt" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_presets_tenant_id_preset_id_key" ON "user_presets"("tenant_id", "preset_id");

-- CreateIndex
CREATE INDEX "user_presets_tenant_id_idx" ON "user_presets"("tenant_id");

-- CreateIndex
CREATE INDEX "user_presets_user_id_idx" ON "user_presets"("user_id");

-- CreateIndex
CREATE INDEX "user_presets_family_idx" ON "user_presets"("family");

-- AddForeignKey
ALTER TABLE "user_presets" ADD CONSTRAINT "user_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_presets" ADD CONSTRAINT "user_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
