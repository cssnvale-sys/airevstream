-- CreateTable
CREATE TABLE "account_lifecycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_account_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatar_id" UUID,
    "auto_seasoning" BOOLEAN NOT NULL DEFAULT true,
    "auto_posting" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "discovery_results" JSONB NOT NULL DEFAULT '{}',
    "cohort_id" UUID,
    "current_step" VARCHAR(50),
    "error" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_lifecycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_lifecycles_email_account_id_key" ON "account_lifecycles"("email_account_id");

-- CreateIndex
CREATE INDEX "account_lifecycles_tenant_id_idx" ON "account_lifecycles"("tenant_id");

-- CreateIndex
CREATE INDEX "account_lifecycles_status_idx" ON "account_lifecycles"("status");

-- AddForeignKey
ALTER TABLE "account_lifecycles" ADD CONSTRAINT "account_lifecycles_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_lifecycles" ADD CONSTRAINT "account_lifecycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
