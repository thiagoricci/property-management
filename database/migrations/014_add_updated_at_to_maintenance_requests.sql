-- Add updated_at column to maintenance_requests table
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
