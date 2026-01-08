-- Update the check constraint to include 'location' type
ALTER TABLE public.custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_field_type_check 
CHECK (field_type IN ('select', 'boolean', 'multi_select', 'number', 'currency', 'text', 'date', 'user', 'instagram', 'location'));