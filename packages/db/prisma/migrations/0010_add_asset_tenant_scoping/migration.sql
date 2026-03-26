-- Add tenantId to Avatar
ALTER TABLE "avatars" ADD COLUMN "tenant_id" UUID;

-- Backfill: assign existing avatars to the first tenant
UPDATE "avatars" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
WHERE "tenant_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "avatars" ALTER COLUMN "tenant_id" SET NOT NULL;

-- FK + index
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "avatars_tenant_id_idx" ON "avatars"("tenant_id");

-- Add tenantId + updatedAt to SceneryAsset
ALTER TABLE "scenery_assets" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "scenery_assets" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: assign existing scenery to the first tenant
UPDATE "scenery_assets" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
WHERE "tenant_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "scenery_assets" ALTER COLUMN "tenant_id" SET NOT NULL;

-- FK + index
ALTER TABLE "scenery_assets" ADD CONSTRAINT "scenery_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "scenery_assets_tenant_id_idx" ON "scenery_assets"("tenant_id");

-- Add avatarId to AssetRegistryEntry
ALTER TABLE "asset_registry_entries" ADD COLUMN "avatar_id" UUID;
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "asset_registry_entries_avatar_id_idx" ON "asset_registry_entries"("avatar_id");
