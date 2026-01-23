-- Migration 009: Add Thread Enhancement Features
-- This migration adds features for thread merging, topic categorization, and escalation tracking
-- Date: 2026-01-22

BEGIN;

-- Add topic categorization columns to conversation_threads
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS topic_category VARCHAR(50);
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS subtopic VARCHAR(50);

-- Add thread merging tracking columns
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS merged_from INTEGER[];
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS merged_into INTEGER;

-- Add escalation detection column
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS is_escalating BOOLEAN DEFAULT FALSE;
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS escalation_confidence FLOAT;
ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS escalation_reasoning TEXT;

-- Note: If constraint already exists, it will be automatically updated with new values
-- The status column already has a check constraint, so we skip this step

-- Add comments for documentation
COMMENT ON COLUMN conversation_threads.topic_category IS 'AI-categorized topic: maintenance, rent, amenities, lease, general, other';
COMMENT ON COLUMN conversation_threads.subtopic IS 'Specific subtopic within category (e.g., plumbing, heating, parking)';
COMMENT ON COLUMN conversation_threads.merged_from IS 'Array of thread IDs that were merged into this thread';
COMMENT ON COLUMN conversation_threads.merged_into IS 'Thread ID this thread was merged into (if merged)';
COMMENT ON COLUMN conversation_threads.is_escalating IS 'True if conversation is escalating (tenant frustrated, issue unresolved)';
COMMENT ON COLUMN conversation_threads.escalation_confidence IS 'Confidence score (0.0-1.0) for escalation detection';
COMMENT ON COLUMN conversation_threads.escalation_reasoning IS 'AI reasoning for escalation detection';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_topic_category ON conversation_threads(topic_category);
CREATE INDEX IF NOT EXISTS idx_threads_escalating ON conversation_threads(is_escalating);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(status);

-- Create thread_relationships table for conversation clustering
CREATE TABLE IF NOT EXISTS thread_relationships (
  id SERIAL PRIMARY KEY,
  thread_id_1 INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE,
  thread_id_2 INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE,
  relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('similar', 'related', 'follow-up')),
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(thread_id_1, thread_id_2)
);

-- Add indexes for thread_relationships
CREATE INDEX IF NOT EXISTS idx_thread_rel_type ON thread_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_thread_rel_confidence ON thread_relationships(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_thread_rel_thread1 ON thread_relationships(thread_id_1);
CREATE INDEX IF NOT EXISTS idx_thread_rel_thread2 ON thread_relationships(thread_id_2);

-- Add comment for thread_relationships
COMMENT ON TABLE thread_relationships IS 'Links related threads for clustering and context';
COMMENT ON COLUMN thread_relationships.relationship_type IS 'Type of relationship: similar (same issue), related (connected topic), follow-up (continuation)';

COMMIT;

-- Verify migration
SELECT 'Migration 009 completed successfully' as status;
SELECT COUNT(*) as total_threads FROM conversation_threads;
SELECT COUNT(*) as total_relationships FROM thread_relationships;
