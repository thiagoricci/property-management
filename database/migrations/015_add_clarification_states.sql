-- Migration: Add clarification_states table for conversational duplicate prevention
-- This table tracks when we're waiting for tenant clarification about duplicate requests

CREATE TABLE clarification_states (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE CASCADE,
  maintenance_request_id INTEGER REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL,
  state VARCHAR(20) NOT NULL CHECK (state IN ('pending', 'answered', 'expired')),
  question TEXT NOT NULL,
  asked_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_clarification_tenant_id ON clarification_states(tenant_id);
CREATE INDEX idx_clarification_thread_id ON clarification_states(thread_id);
CREATE INDEX idx_clarification_state ON clarification_states(state);
CREATE INDEX idx_clarification_expires_at ON clarification_states(expires_at);

-- Add comment to table
COMMENT ON TABLE clarification_states IS 'Tracks clarification states when asking tenants if new messages are about existing maintenance requests';

COMMENT ON COLUMN clarification_states.state IS 'State of clarification: pending (waiting), answered (got response), expired (timeout)';
COMMENT ON COLUMN clarification_states.expires_at IS 'When clarification becomes invalid (24 hours after asked_at)';
