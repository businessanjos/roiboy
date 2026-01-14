-- First, drop the existing check constraint on field_type
ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

-- Add the updated check constraint with multi_instagram type
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select', 'multi_select', 'currency', 'user', 'instagram', 'location', 'multi_instagram'));