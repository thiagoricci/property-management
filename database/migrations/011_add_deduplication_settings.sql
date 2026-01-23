-- Migration: 011_add_deduplication_settings.sql
-- Description: Add deduplication configuration settings to properties table
-- Created: 2026-01-22

-- Add deduplication settings columns to properties table
ALTER TABLE properties
ADD COLUMN dedup_time_window_days INTEGER DEFAULT 30,
ADD COLUMN dedup_confidence_threshold DECIMAL(3,2) DEFAULT 0.60,
ADD COLUMN dedup_max_requests_to_check INTEGER DEFAULT 5;

-- Add comments to explain the new columns
COMMENT ON COLUMN properties.dedup_time_window_days IS 'How many days back to check for duplicate maintenance requests (default: 30)';
COMMENT ON COLUMN properties.dedup_confidence_threshold IS 'AI confidence threshold for duplicate detection (0.0-1.0, default: 0.60)';
COMMENT ON COLUMN properties.dedup_max_requests_to_check IS 'Maximum number of requests to analyze per duplicate check (default: 5)';
