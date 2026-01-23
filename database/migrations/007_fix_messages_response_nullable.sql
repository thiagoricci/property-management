-- Migration 007: Fix messages table schema for threading
-- This migration makes the response column nullable to support separate user_message and ai_response records
-- Date: 2026-01-22

BEGIN;

-- 1. Make response column nullable (user messages don't have responses)
ALTER TABLE messages ALTER COLUMN response DROP NOT NULL;

-- 2. Ensure all existing records have proper message_type
-- Set message_type based on whether response is null or not
UPDATE messages
SET message_type = CASE
  WHEN response IS NULL THEN 'user_message'
  ELSE 'ai_response'
END
WHERE message_type IS NULL;

-- 3. Verify the fix
SELECT 'Migration 007 completed successfully' as status;
SELECT COUNT(*) as total_messages FROM messages;
SELECT COUNT(*) as user_messages FROM messages WHERE message_type = 'user_message';
SELECT COUNT(*) as ai_responses FROM messages WHERE message_type = 'ai_response';

COMMIT;
