-- Migration 008: Add Configurable Thread Time Thresholds
-- This migration adds configurable time thresholds per property for conversation threading
-- Date: 2026-01-22

BEGIN;

-- Add thread_time_threshold_hours to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS thread_time_threshold_hours INTEGER DEFAULT 48;

-- Add comment for documentation
COMMENT ON COLUMN properties.thread_time_threshold_hours IS 'Hours of inactivity before creating a new conversation thread. Default: 48 hours. Property managers can customize based on tenant communication patterns.';

-- Update existing properties with default value
UPDATE properties SET thread_time_threshold_hours = 48 WHERE thread_time_threshold_hours IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_properties_thread_threshold ON properties(thread_time_threshold_hours);

COMMIT;

-- Verify migration
SELECT 'Migration 008 completed successfully' as status;
SELECT COUNT(*) as properties_updated FROM properties WHERE thread_time_threshold_hours = 48;
