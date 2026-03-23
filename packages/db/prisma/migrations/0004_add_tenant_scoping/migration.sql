-- Add tenant_id to Alert (nullable — workers create system alerts without tenant context)
ALTER TABLE "alerts" ADD COLUMN "tenant_id" UUID;

-- Add tenant_id to Conversation, KnowledgeBaseEntry, PromptTemplate, CostBudget (nullable first for backfill)
ALTER TABLE "conversations" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "knowledge_base_entries" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "prompt_templates" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "cost_budgets" ADD COLUMN "tenant_id" UUID;

-- Backfill existing rows with the first tenant
UPDATE "conversations" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "knowledge_base_entries" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "prompt_templates" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1) WHERE "tenant_id" IS NULL;
UPDATE "cost_budgets" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1) WHERE "tenant_id" IS NULL;

-- Set NOT NULL on the 4 required models (Alert stays nullable)
ALTER TABLE "conversations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "knowledge_base_entries" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "prompt_templates" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "cost_budgets" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_base_entries" ADD CONSTRAINT "knowledge_base_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_budgets" ADD CONSTRAINT "cost_budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes on tenant_id
CREATE INDEX "alerts_tenant_id_idx" ON "alerts"("tenant_id");
CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");
CREATE INDEX "knowledge_base_entries_tenant_id_idx" ON "knowledge_base_entries"("tenant_id");
CREATE INDEX "prompt_templates_tenant_id_idx" ON "prompt_templates"("tenant_id");
CREATE INDEX "cost_budgets_tenant_id_idx" ON "cost_budgets"("tenant_id");
