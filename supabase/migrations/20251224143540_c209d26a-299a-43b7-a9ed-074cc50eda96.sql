-- Add due_date column to stage_checklist_items for deadline tracking
ALTER TABLE public.stage_checklist_items
ADD COLUMN due_date date NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.stage_checklist_items.due_date IS 'Optional deadline for this checklist item';