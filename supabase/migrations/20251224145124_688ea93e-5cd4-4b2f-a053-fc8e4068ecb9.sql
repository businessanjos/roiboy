-- Add action_type column to checklist items for linking to specific actions
ALTER TABLE public.stage_checklist_items 
ADD COLUMN action_type TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.stage_checklist_items.action_type IS 'Type of action to perform when clicking the checklist item. Values: client_info, client_products, client_forms, client_fields, client_contracts, client_financial, client_cx, client_relationships, client_agenda, client_sales';