-- Full-text search GIN indexes for PostgreSQL
-- Enables efficient text search via Prisma's fullTextSearchPostgres preview feature

-- Content items: search by title and prompt
CREATE INDEX IF NOT EXISTS "content_items_title_search_idx"
  ON "content_items" USING GIN (to_tsvector('english', COALESCE("title", '')));

CREATE INDEX IF NOT EXISTS "content_items_prompt_search_idx"
  ON "content_items" USING GIN (to_tsvector('english', COALESCE("prompt", '')));

-- Knowledge base: search by title and content
CREATE INDEX IF NOT EXISTS "knowledge_base_entries_title_search_idx"
  ON "knowledge_base_entries" USING GIN (to_tsvector('english', "title"));

CREATE INDEX IF NOT EXISTS "knowledge_base_entries_content_search_idx"
  ON "knowledge_base_entries" USING GIN (to_tsvector('english', "content"));

-- Email accounts: search by email
CREATE INDEX IF NOT EXISTS "email_accounts_email_search_idx"
  ON "email_accounts" USING GIN (to_tsvector('simple', "email"));

-- Channels: search by name
CREATE INDEX IF NOT EXISTS "channels_name_search_idx"
  ON "channels" USING GIN (to_tsvector('english', "name"));

-- Conversations: search by title
CREATE INDEX IF NOT EXISTS "conversations_title_search_idx"
  ON "conversations" USING GIN (to_tsvector('english', COALESCE("title", '')));

-- Conversation messages: search by content
CREATE INDEX IF NOT EXISTS "conversation_messages_content_search_idx"
  ON "conversation_messages" USING GIN (to_tsvector('english', "content"));

-- Affiliate products: search by name and description
CREATE INDEX IF NOT EXISTS "affiliate_products_name_search_idx"
  ON "affiliate_products" USING GIN (to_tsvector('english', "name"));

CREATE INDEX IF NOT EXISTS "affiliate_products_description_search_idx"
  ON "affiliate_products" USING GIN (to_tsvector('english', COALESCE("description", '')));

-- Alerts: search by title
CREATE INDEX IF NOT EXISTS "alerts_title_search_idx"
  ON "alerts" USING GIN (to_tsvector('english', "title"));
