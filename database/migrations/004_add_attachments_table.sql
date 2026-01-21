-- Migration 004: Add attachments table for email attachments (photos of issues)
-- This migration adds support for storing email attachments, particularly
-- photos that tenants send when reporting maintenance issues.

-- Attachments table for email attachments (photos of issues)
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by conversation
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON attachments(conversation_id);

-- Index for faster lookups by stored filename
CREATE INDEX IF NOT EXISTS idx_attachments_stored_filename ON attachments(stored_filename);

-- Add comments for documentation
COMMENT ON TABLE attachments IS 'Stores email attachments, primarily photos sent by tenants when reporting maintenance issues';
COMMENT ON COLUMN attachments.conversation_id IS 'Foreign key to the conversation this attachment belongs to';
COMMENT ON COLUMN attachments.filename IS 'Original filename from the email';
COMMENT ON COLUMN attachments.stored_filename IS 'Unique filename used for storage';
COMMENT ON COLUMN attachments.content_type IS 'MIME type of the attachment (e.g., image/jpeg)';
COMMENT ON COLUMN attachments.size IS 'File size in bytes';
COMMENT ON COLUMN attachments.url IS 'URL path to access the attachment';

-- Add trigger to automatically delete files from disk when attachment is deleted
-- Note: This requires a function to be created in a separate migration or manually
-- CREATE OR REPLACE FUNCTION delete_attachment_file()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Delete file from disk
--   PERFORM pg_notify('delete_attachment', OLD.stored_filename);
--   RETURN OLD;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trigger_delete_attachment_file
--   AFTER DELETE ON attachments
--   FOR EACH ROW
--   EXECUTE FUNCTION delete_attachment_file();
