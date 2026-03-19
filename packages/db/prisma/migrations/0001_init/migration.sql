-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(30) NOT NULL DEFAULT 'free',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'operator',
    "tenant_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_enc" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "tier" VARCHAR(10) NOT NULL DEFAULT 'tier2',
    "tenant_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "email_account_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "platform_user_id" VARCHAR(255),
    "username" VARCHAR(255),
    "credentials_enc" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "last_login_at" TIMESTAMPTZ,
    "last_post_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "platform_channel_id" VARCHAR(255),
    "primary_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "family_id" UUID,
    "niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" VARCHAR(50),
    "personality" TEXT,
    "target_audience" TEXT,
    "posting_cadence" JSONB NOT NULL DEFAULT '{}',
    "cinema_bible_id" UUID,
    "platform_metadata" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" JSONB NOT NULL,
    "trait_lock" JSONB NOT NULL DEFAULT '{}',
    "images" JSONB NOT NULL DEFAULT '{}',
    "voice_profiles" JSONB NOT NULL DEFAULT '{}',
    "generation_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_avatars" (
    "channel_id" UUID NOT NULL,
    "avatar_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "role" VARCHAR(50),

    CONSTRAINT "channel_avatars_pkey" PRIMARY KEY ("channel_id","avatar_id")
);

-- CreateTable
CREATE TABLE "branding_packages" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "colors" JSONB NOT NULL DEFAULT '{}',
    "fonts" JSONB NOT NULL DEFAULT '{}',
    "templates" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branding_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenery_assets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50),
    "image_url" TEXT NOT NULL,
    "prompt" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenery_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_scenery" (
    "channel_id" UUID NOT NULL,
    "scenery_id" UUID NOT NULL,

    CONSTRAINT "channel_scenery_pkey" PRIMARY KEY ("channel_id","scenery_id")
);

-- CreateTable
CREATE TABLE "cinema_bibles" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "look_bible" JSONB NOT NULL DEFAULT '{}',
    "character_bible" JSONB NOT NULL DEFAULT '{}',
    "environment_bible" JSONB NOT NULL DEFAULT '{}',
    "prompt_bible" JSONB NOT NULL DEFAULT '{}',
    "shotspec_template" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cinema_bibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "service_type" VARCHAR(20) NOT NULL,
    "endpoint" TEXT,
    "api_key_enc" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "rate_limits" JSONB NOT NULL DEFAULT '{}',
    "cost_per_unit" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "last_health_check" TIMESTAMPTZ,
    "avg_response_ms" INTEGER,
    "success_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "avg_quality_score" DECIMAL(3,1),
    "fallback_order" INTEGER NOT NULL DEFAULT 0,
    "fallback_group" VARCHAR(50),
    "is_local" BOOLEAN NOT NULL DEFAULT false,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_service_usage" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "content_id" UUID,
    "channel_id" UUID,
    "request_type" VARCHAR(50),
    "tokens_used" INTEGER,
    "duration_sec" DECIMAL(8,2),
    "cost" DECIMAL(10,4),
    "quality_score" DECIMAL(3,1),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "response_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_service_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "title" VARCHAR(500),
    "content_type" VARCHAR(30) NOT NULL,
    "content_purpose" VARCHAR(30),
    "prompt" TEXT,
    "generation_params" JSONB NOT NULL DEFAULT '{}',
    "ai_service_id" UUID,
    "quality_score" DECIMAL(3,1),
    "file_url" TEXT,
    "thumbnail_url" TEXT,
    "platform_metadata" JSONB NOT NULL DEFAULT '{}',
    "beat_tags" JSONB NOT NULL DEFAULT '[]',
    "duration_sec" DECIMAL(8,2),
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "affiliate_product_id" UUID,
    "affiliate_mode" VARCHAR(20),
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" UUID,
    "language_family_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "approval_gate_window_hrs" DECIMAL(5,1),
    "approved_at" TIMESTAMPTZ,
    "approved_by" VARCHAR(50),
    "performance" JSONB NOT NULL DEFAULT '{}',
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboards" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "script_json" JSONB NOT NULL,
    "sound_plan_json" JSONB,
    "total_duration_sec" DECIMAL(8,2),
    "fps" INTEGER NOT NULL DEFAULT 24,
    "aspect_ratio" VARCHAR(10) NOT NULL DEFAULT '16:9',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storyboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboard_shots" (
    "id" UUID NOT NULL,
    "storyboard_id" UUID NOT NULL,
    "shot_number" INTEGER NOT NULL,
    "shotspec" JSONB NOT NULL,
    "keyframe_urls" JSONB NOT NULL DEFAULT '[]',
    "plate_video_url" TEXT,
    "matte_urls" JSONB NOT NULL DEFAULT '[]',
    "audio_stem_urls" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "quality_score" DECIMAL(3,1),
    "generation_cost" DECIMAL(10,4),
    "ai_service_id" UUID,
    "start_sec" DECIMAL(8,2) NOT NULL,
    "end_sec" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storyboard_shots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "publish_config" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "posted_at" TIMESTAMPTZ,
    "platform_post_id" VARCHAR(255),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "social_account_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "short_url" TEXT,
    "description" TEXT,
    "sales_angle" TEXT,
    "category" VARCHAR(100),
    "brand" VARCHAR(100),
    "commission_rate" DECIMAL(5,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "image_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "total_conversions" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_affiliate_pools" (
    "channel_id" UUID NOT NULL,
    "affiliate_product_id" UUID NOT NULL,
    "is_auto_suggested" BOOLEAN NOT NULL DEFAULT false,
    "performance_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,

    CONSTRAINT "channel_affiliate_pools_pkey" PRIMARY KEY ("channel_id","affiliate_product_id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "content_id" UUID,
    "channel_id" UUID,
    "platform" VARCHAR(20),
    "ip_hash" VARCHAR(64),
    "user_agent" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "revenue" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_trust_scores" (
    "id" UUID NOT NULL,
    "dimension_type" VARCHAR(30) NOT NULL,
    "dimension_value" VARCHAR(100) NOT NULL,
    "trust_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gate_window_hrs" DECIMAL(5,1) NOT NULL DEFAULT 24,
    "total_approved" INTEGER NOT NULL DEFAULT 0,
    "total_rejected" INTEGER NOT NULL DEFAULT 0,
    "total_auto_approved" INTEGER NOT NULL DEFAULT 0,
    "avg_outcome_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "approval_trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255),
    "context_page" VARCHAR(100),
    "model_used" VARCHAR(100),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "action_proposed" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_audit_log" (
    "id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "tier" INTEGER NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20),
    "rollback_data" JSONB,
    "conversation_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_jobs" (
    "id" UUID NOT NULL,
    "job_type" VARCHAR(50) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "channel_id" UUID,
    "content_id" UUID,
    "email_account_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "eta_sec" INTEGER,
    "params" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "needs_human" BOOLEAN NOT NULL DEFAULT false,
    "human_task_desc" TEXT,
    "human_links" JSONB NOT NULL DEFAULT '[]',
    "human_completed_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "source" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "acknowledged_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" UUID NOT NULL,
    "metric_type" VARCHAR(50) NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "knowledge_base_entries" (
    "id" UUID NOT NULL,
    "domain" VARCHAR(50) NOT NULL,
    "category" VARCHAR(100),
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "source_url" TEXT,
    "relevance_score" DECIMAL(3,1),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_base_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefronts" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "custom_domain" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storefronts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_products" (
    "id" UUID NOT NULL,
    "storefront_id" UUID NOT NULL,
    "affiliate_product_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "custom_title" VARCHAR(255),
    "custom_description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT "storefront_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(20),
    "content_type" VARCHAR(30),
    "template" TEXT NOT NULL,
    "negative_prompt" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DECIMAL(3,1),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_budgets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "budget_type" VARCHAR(30) NOT NULL,
    "limit_amount" DECIMAL(10,2) NOT NULL,
    "current_spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "alert_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.8,
    "category" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cost_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "external_id" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key_hash" VARCHAR(128) NOT NULL,
    "key_prefix" VARCHAR(12) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit_rpm" INTEGER NOT NULL DEFAULT 60,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_email_key" ON "email_accounts"("email");

-- CreateIndex
CREATE INDEX "email_accounts_tenant_id_idx" ON "email_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "social_accounts_email_account_id_idx" ON "social_accounts"("email_account_id");

-- CreateIndex
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_email_account_id_platform_key" ON "social_accounts"("email_account_id", "platform");

-- CreateIndex
CREATE INDEX "channels_social_account_id_idx" ON "channels"("social_account_id");

-- CreateIndex
CREATE INDEX "channels_family_id_idx" ON "channels"("family_id");

-- CreateIndex
CREATE INDEX "branding_packages_channel_id_idx" ON "branding_packages"("channel_id");

-- CreateIndex
CREATE INDEX "cinema_bibles_channel_id_version_idx" ON "cinema_bibles"("channel_id", "version");

-- CreateIndex
CREATE INDEX "ai_services_service_type_idx" ON "ai_services"("service_type");

-- CreateIndex
CREATE INDEX "ai_services_fallback_group_fallback_order_idx" ON "ai_services"("fallback_group", "fallback_order");

-- CreateIndex
CREATE INDEX "ai_service_usage_service_id_idx" ON "ai_service_usage"("service_id");

-- CreateIndex
CREATE INDEX "ai_service_usage_created_at_idx" ON "ai_service_usage"("created_at");

-- CreateIndex
CREATE INDEX "content_items_channel_id_idx" ON "content_items"("channel_id");

-- CreateIndex
CREATE INDEX "content_items_status_idx" ON "content_items"("status");

-- CreateIndex
CREATE INDEX "content_items_content_type_idx" ON "content_items"("content_type");

-- CreateIndex
CREATE INDEX "content_items_language_family_id_idx" ON "content_items"("language_family_id");

-- CreateIndex
CREATE INDEX "storyboards_content_id_idx" ON "storyboards"("content_id");

-- CreateIndex
CREATE INDEX "storyboard_shots_storyboard_id_shot_number_idx" ON "storyboard_shots"("storyboard_id", "shot_number");

-- CreateIndex
CREATE INDEX "scheduled_posts_channel_id_scheduled_at_idx" ON "scheduled_posts"("channel_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_scheduled_at_idx" ON "scheduled_posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "affiliate_products_status_idx" ON "affiliate_products"("status");

-- CreateIndex
CREATE INDEX "affiliate_clicks_product_id_created_at_idx" ON "affiliate_clicks"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_trust_scores_dimension_type_dimension_value_key" ON "approval_trust_scores"("dimension_type", "dimension_value");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_created_at_idx" ON "conversation_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "action_audit_log_conversation_id_created_at_idx" ON "action_audit_log"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_jobs_status_priority_idx" ON "workflow_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "workflow_jobs_job_type_idx" ON "workflow_jobs"("job_type");

-- CreateIndex
CREATE INDEX "workflow_jobs_status_job_type_idx" ON "workflow_jobs"("status", "job_type");

-- CreateIndex
CREATE INDEX "alerts_status_severity_idx" ON "alerts"("status", "severity");

-- CreateIndex
CREATE INDEX "alerts_status_resolved_at_idx" ON "alerts"("status", "resolved_at");

-- CreateIndex
CREATE INDEX "system_metrics_metric_type_created_at_idx" ON "system_metrics"("metric_type", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_base_entries_domain_idx" ON "knowledge_base_entries"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_slug_key" ON "storefronts"("slug");

-- CreateIndex
CREATE INDEX "storefronts_channel_id_idx" ON "storefronts"("channel_id");

-- CreateIndex
CREATE INDEX "storefront_products_storefront_id_display_order_idx" ON "storefront_products"("storefront_id", "display_order");

-- CreateIndex
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");

-- CreateIndex
CREATE INDEX "prompt_templates_platform_idx" ON "prompt_templates"("platform");

-- CreateIndex
CREATE INDEX "cost_budgets_status_idx" ON "cost_budgets"("status");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_avatars" ADD CONSTRAINT "channel_avatars_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_avatars" ADD CONSTRAINT "channel_avatars_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding_packages" ADD CONSTRAINT "branding_packages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_scenery" ADD CONSTRAINT "channel_scenery_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_scenery" ADD CONSTRAINT "channel_scenery_scenery_id_fkey" FOREIGN KEY ("scenery_id") REFERENCES "scenery_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cinema_bibles" ADD CONSTRAINT "cinema_bibles_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_service_usage" ADD CONSTRAINT "ai_service_usage_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "ai_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_service_usage" ADD CONSTRAINT "ai_service_usage_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_service_usage" ADD CONSTRAINT "ai_service_usage_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_ai_service_id_fkey" FOREIGN KEY ("ai_service_id") REFERENCES "ai_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_affiliate_product_id_fkey" FOREIGN KEY ("affiliate_product_id") REFERENCES "affiliate_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboards" ADD CONSTRAINT "storyboards_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboard_shots" ADD CONSTRAINT "storyboard_shots_storyboard_id_fkey" FOREIGN KEY ("storyboard_id") REFERENCES "storyboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboard_shots" ADD CONSTRAINT "storyboard_shots_ai_service_id_fkey" FOREIGN KEY ("ai_service_id") REFERENCES "ai_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_affiliate_pools" ADD CONSTRAINT "channel_affiliate_pools_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_affiliate_pools" ADD CONSTRAINT "channel_affiliate_pools_affiliate_product_id_fkey" FOREIGN KEY ("affiliate_product_id") REFERENCES "affiliate_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "affiliate_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_audit_log" ADD CONSTRAINT "action_audit_log_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_jobs" ADD CONSTRAINT "workflow_jobs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_products" ADD CONSTRAINT "storefront_products_storefront_id_fkey" FOREIGN KEY ("storefront_id") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

