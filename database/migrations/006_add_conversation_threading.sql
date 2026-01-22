-- Migration 006: Add Conversation Threading Support
-- This migration adds proper conversation threading to separate topics from individual messages
-- Date: 2026-01-21

BEGIN;

-- 1. Create conversation_threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  summary TEXT
);

-- 2. Rename conversations table to messages
ALTER TABLE IF EXISTS conversations RENAME TO messages;

-- 3. Add thread_id column to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE;

-- 4. Add message_type column to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'user_message'
  CHECK (message_type IN ('user_message', 'ai_response'));

-- 5. Update all existing records to have message_type
UPDATE messages SET message_type = 'user_message' WHERE message_type IS NULL;

-- 6. Create threads for existing messages (one thread per original conversation)
-- This preserves existing data while establishing thread structure
INSERT INTO conversation_threads (tenant_id, property_id, subject, channel, created_at, last_activity_at)
SELECT
  m.tenant_id,
  t.property_id,
  COALESCE(m.subject, LEFT(m.message, 100)) as subject,
  m.channel,
  m.timestamp,
  m.timestamp
FROM messages m
LEFT JOIN tenants t ON m.tenant_id = t.id
WHERE m.thread_id IS NULL;

-- 7. Link existing messages to their new threads
-- Match by tenant_id, channel, and timestamp to find the correct thread
UPDATE messages m
SET thread_id = ct.id
FROM conversation_threads ct
WHERE ct.tenant_id = m.tenant_id
  AND ct.channel = m.channel
  AND ct.created_at = m.timestamp
  AND m.thread_id IS NULL;

-- 8. Update maintenance_requests foreign key (conversation_id → message_id)
-- Check if column exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'maintenance_requests'
        AND column_name = 'conversation_id'
    ) THEN
        -- Drop old foreign key constraint if it exists
        ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_conversation_id_fkey;

        -- Rename column
        ALTER TABLE maintenance_requests RENAME COLUMN conversation_id TO message_id;

        -- Add new foreign key constraint
        ALTER TABLE maintenance_requests ADD CONSTRAINT maintenance_requests_message_id_fkey
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. Update attachments foreign key (conversation_id → message_id)
-- Check if column exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attachments'
        AND column_name = 'conversation_id'
    ) THEN
        -- Drop old foreign key constraint if it exists
        ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_conversation_id_fkey;

        -- Rename column
        ALTER TABLE attachments RENAME COLUMN conversation_id TO message_id;

        -- Add new foreign key constraint
        ALTER TABLE attachments ADD CONSTRAINT attachments_message_id_fkey
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 10. Create indexes for performance on conversation_threads
CREATE INDEX IF NOT EXISTS idx_threads_tenant_id ON conversation_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_last_activity ON conversation_threads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_tenant_status ON conversation_threads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_threads_channel ON conversation_threads(channel);

-- 11. Create indexes for performance on messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_timestamp ON messages(thread_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

-- 12. Add comments for documentation
COMMENT ON TABLE conversation_threads IS 'Groups related messages by topic/subject. Each thread represents a single conversation about a specific issue.';
COMMENT ON COLUMN conversation_threads.subject IS 'AI-generated or extracted subject line describing the conversation topic';
COMMENT ON COLUMN conversation_threads.status IS 'Thread status: active (ongoing), resolved (completed), escalated (requires manager intervention)';
COMMENT ON COLUMN conversation_threads.last_activity_at IS 'Timestamp of last message in thread, used for sorting and activity tracking';
COMMENT ON COLUMN conversation_threads.summary IS 'Optional AI-generated summary of the conversation';

COMMENT ON TABLE messages IS 'Individual message/response exchanges. Each row represents one tenant message and AI response pair';
COMMENT ON COLUMN messages.thread_id IS 'Foreign key to conversation_threads table';
COMMENT ON COLUMN messages.message_type IS 'Type of message: user_message (from tenant) or ai_response (from AI assistant)';

COMMIT;

-- Verify migration
SELECT 'Migration 006 completed successfully' as status;
SELECT COUNT(*) as total_threads FROM conversation_threads;
SELECT COUNT(*) as total_messages FROM messages;
SELECT COUNT(*) as messages_with_threads FROM messages WHERE thread_id IS NOT NULL;
