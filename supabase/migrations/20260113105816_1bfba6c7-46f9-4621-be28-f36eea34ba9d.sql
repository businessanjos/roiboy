-- Remove the old constraint
ALTER TABLE playbook_items 
DROP CONSTRAINT IF EXISTS playbook_items_content_type_check;

-- Add the updated constraint with 'link' and 'template' types
ALTER TABLE playbook_items 
ADD CONSTRAINT playbook_items_content_type_check 
CHECK (content_type = ANY (ARRAY['text', 'audio', 'image', 'video', 'document', 'sticker', 'list', 'link', 'template']));