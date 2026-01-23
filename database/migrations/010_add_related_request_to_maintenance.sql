-- Migration: 010_add_related_request_to_maintenance.sql
-- Description: Add support for linking maintenance requests across different conversation threads
-- Created: 2026-01-22

-- Add columns for cross-thread deduplication
ALTER TABLE maintenance_requests
ADD COLUMN related_request_id INTEGER REFERENCES maintenance_requests(id),
ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE,
ADD COLUMN duplicate_reason TEXT;

-- Add index for efficient cross-thread queries (tenant + status + time)
CREATE INDEX idx_maintenance_tenant_status
  ON maintenance_requests(tenant_id, status, created_at DESC);

-- Add index for related request lookups
CREATE INDEX idx_maintenance_related_request
  ON maintenance_requests(related_request_id);

-- Add index for duplicate detection
CREATE INDEX idx_maintenance_duplicate
  ON maintenance_requests(is_duplicate, tenant_id);

-- Add comment to explain the columns
COMMENT ON COLUMN maintenance_requests.related_request_id IS 'Links to the original maintenance request when this is a duplicate or related request from a different thread';
COMMENT ON COLUMN maintenance_requests.is_duplicate IS 'Flag indicating if this request is a duplicate of another request';
COMMENT ON COLUMN maintenance_requests.duplicate_reason IS 'AI reasoning for marking this request as a duplicate';
