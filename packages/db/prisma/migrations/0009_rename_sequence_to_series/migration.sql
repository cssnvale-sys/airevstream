-- ============================================================
-- Migration: Rename Sequence → Series, SequenceItem → Episode
-- Data-preserving: uses ALTER TABLE RENAME, no data loss
-- ============================================================

-- Step 1: Drop existing foreign key constraints referencing old table names
ALTER TABLE "sequence_items" DROP CONSTRAINT IF EXISTS "sequence_items_sequence_id_fkey";
ALTER TABLE "sequence_items" DROP CONSTRAINT IF EXISTS "sequence_items_content_id_fkey";
ALTER TABLE "asset_registry_entries" DROP CONSTRAINT IF EXISTS "asset_registry_entries_sequence_id_fkey";
ALTER TABLE "sequences" DROP CONSTRAINT IF EXISTS "sequences_channel_id_fkey";

-- Step 2: Rename table sequences → series
ALTER TABLE "sequences" RENAME TO "series";

-- Step 3: Add new columns to series
ALTER TABLE "series" ADD COLUMN "cover_image_url" TEXT;
ALTER TABLE "series" ADD COLUMN "target_audience" TEXT;
ALTER TABLE "series" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "series" ADD COLUMN "default_preset_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "series" ADD COLUMN "default_recipe_id" VARCHAR(100);
ALTER TABLE "series" ADD COLUMN "bible_overrides" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "series" ADD COLUMN "posting_cadence" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "series" ADD COLUMN "youtube_playlist_id" VARCHAR(100);
ALTER TABLE "series" ADD COLUMN "base_seed" INTEGER;

-- Step 4: Rename table sequence_items → episodes
ALTER TABLE "sequence_items" RENAME TO "episodes";

-- Step 5: Drop old composite PK on episodes (was sequence_id, content_id)
ALTER TABLE "episodes" DROP CONSTRAINT IF EXISTS "sequence_items_pkey";

-- Step 6: Rename column sequence_id → series_id on episodes
ALTER TABLE "episodes" RENAME COLUMN "sequence_id" TO "series_id";

-- Step 7: Add new columns to episodes
ALTER TABLE "episodes" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "episodes" ADD COLUMN "episode_number" INTEGER;
ALTER TABLE "episodes" ADD COLUMN "title" VARCHAR(500);
ALTER TABLE "episodes" ADD COLUMN "published_at" TIMESTAMPTZ;

-- Step 8: Backfill episode_number from position
UPDATE "episodes" SET "episode_number" = "position" WHERE "episode_number" IS NULL;
ALTER TABLE "episodes" ALTER COLUMN "episode_number" SET NOT NULL;

-- Step 9: Add new PK on episodes (id)
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_pkey" PRIMARY KEY ("id");

-- Step 10: Create series_avatars join table
CREATE TABLE "series_avatars" (
    "series_id" UUID NOT NULL,
    "avatar_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "role" VARCHAR(50),

    CONSTRAINT "series_avatars_pkey" PRIMARY KEY ("series_id","avatar_id")
);

-- Step 11: Rename column sequence_id → series_id on asset_registry_entries
ALTER TABLE "asset_registry_entries" RENAME COLUMN "sequence_id" TO "series_id";

-- Step 12: Add optional series_id to content_items
ALTER TABLE "content_items" ADD COLUMN "series_id" UUID;

-- Step 13: Backfill content_items.series_id from episodes
UPDATE "content_items" ci
SET "series_id" = e."series_id"
FROM "episodes" e
WHERE e."content_id" = ci."id"
  AND ci."series_id" IS NULL;

-- Step 14: Recreate indexes (old index names may conflict)
DROP INDEX IF EXISTS "sequences_channel_id_idx";
DROP INDEX IF EXISTS "sequence_items_sequence_id_position_idx";

CREATE INDEX "series_channel_id_idx" ON "series"("channel_id");
CREATE INDEX "episodes_series_id_position_idx" ON "episodes"("series_id", "position");
CREATE UNIQUE INDEX "episodes_series_id_episode_number_key" ON "episodes"("series_id", "episode_number");
CREATE INDEX "content_items_series_id_idx" ON "content_items"("series_id");

-- Step 15: Recreate foreign key constraints
ALTER TABLE "series" ADD CONSTRAINT "series_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_registry_entries" ADD CONSTRAINT "asset_registry_entries_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "series_avatars" ADD CONSTRAINT "series_avatars_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series_avatars" ADD CONSTRAINT "series_avatars_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
