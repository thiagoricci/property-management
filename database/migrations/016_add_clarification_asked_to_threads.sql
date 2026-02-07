-- Add clarification_asked flag to conversation_threads
-- This prevents the AI from asking "Is this the same issue?" multiple times in the same thread

ALTER TABLE conversation_threads
ADD COLUMN clarification_asked BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN conversation_threads.clarification_asked IS 'Flag to track if duplicate clarification has been asked for this thread. Prevents repeated "same issue" questions within same conversation.';
