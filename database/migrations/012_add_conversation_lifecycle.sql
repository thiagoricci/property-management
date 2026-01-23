-- Migration 012: Add Conversation Lifecycle Enhancements
-- This migration adds enhanced conversation lifecycle management with start/end detection
-- Date: 2026-01-22

BEGIN;

-- 1. Create conversation_events table for tracking thread lifecycle events
CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add indexes for conversation_events
CREATE INDEX IF NOT EXISTS idx_events_thread_id ON conversation_events(thread_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON conversation_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON conversation_events(created_at DESC);

-- 3. Add inactivity settings to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS thread_inactivity_hours INTEGER DEFAULT 72;

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS thread_closure_grace_hours INTEGER DEFAULT 24;

-- 4. Add closure tracking columns to conversation_threads
ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closure_confidence DECIMAL(3,2);

ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closure_factors JSONB;

ALTER TABLE conversation_threads
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- 5. Update status constraint to include new lifecycle states
ALTER TABLE conversation_threads
DROP CONSTRAINT IF EXISTS conversation_threads_status_check;

ALTER TABLE conversation_threads
ADD CONSTRAINT conversation_threads_status_check
CHECK (status IN ('active', 'closing', 'resolved', 'escalated', 'closed'));

-- 6. Add comments for new columns
COMMENT ON COLUMN properties.thread_inactivity_hours IS 'Hours of inactivity before thread auto-closes (default: 72)';
COMMENT ON COLUMN properties.thread_closure_grace_hours IS 'Grace period in hours before closing thread becomes closed (default: 24)';

COMMENT ON COLUMN conversation_threads.closure_confidence IS 'Confidence score (0.0-1.0) for thread closure decision';
COMMENT ON COLUMN conversation_threads.closure_factors IS 'JSON object containing individual factor scores for closure decision';
COMMENT ON COLUMN conversation_threads.closed_at IS 'Timestamp when thread was finally closed';

COMMENT ON TABLE conversation_events IS 'Tracks all lifecycle events for threads (start, close, reopen, auto-close, etc.)';
COMMENT ON COLUMN conversation_events.event_type IS 'Type of event: conversation_started, conversation_closed, auto_closed, manually_closed, reopened, status_changed';

-- 7. Create index for closed_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_threads_closed_at ON conversation_threads(closed_at DESC);

-- 8. Create index for status queries with last_activity
CREATE INDEX IF NOT EXISTS idx_threads_status_activity ON conversation_threads(status, last_activity_at DESC);

COMMIT;

-- Verify migration
SELECT 'Migration 012 completed successfully' as status;
SELECT COUNT(*) as total_events FROM conversation_events;
SELECT COUNT(*) as threads_with_closure_data FROM conversation_threads WHERE closure_confidence IS NOT NULL;
SELECT COUNT(*) as threads_closed FROM conversation_threads WHERE closed_at IS NOT NULL;
