-- Migration 005: Add subject column to conversations table
-- This migration adds support for email subjects in conversations

-- Add subject column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS subject VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN conversations.subject IS 'Email subject line (for email conversations)';
