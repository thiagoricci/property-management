-- Migration 003: Add FAQ field to properties table
-- This allows property managers to add property-specific FAQs
-- that the AI can reference when answering tenant questions

-- Add faq JSONB column to properties table
ALTER TABLE properties ADD COLUMN faq JSONB DEFAULT '{}';

-- Add comment to document the field
COMMENT ON COLUMN properties.faq IS 'Frequently asked questions specific to this property (JSON format)';

-- Example FAQ format:
-- {
--   "wifi_password": "MyProperty2024",
--   "parking": "Parking is available in the rear lot. Spaces are not assigned.",
--   "laundry": "Laundry room is in the basement, open 7am-10pm.",
--   "trash_day": "Trash collection is on Tuesdays and Fridays.",
--   "guest_policy": "Guests allowed for up to 3 nights with prior notice."
-- }
