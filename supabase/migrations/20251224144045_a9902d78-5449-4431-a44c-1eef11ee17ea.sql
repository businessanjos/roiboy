-- Add column to link checklist items to tasks
ALTER TABLE public.stage_checklist_items ADD COLUMN linked_task_id UUID REFERENCES public.internal_tasks(id) ON DELETE SET NULL;

-- Add column to identify tasks created from checklist
ALTER TABLE public.internal_tasks ADD COLUMN checklist_item_id UUID REFERENCES public.stage_checklist_items(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_stage_checklist_items_linked_task ON public.stage_checklist_items(linked_task_id);
CREATE INDEX idx_internal_tasks_checklist_item ON public.internal_tasks(checklist_item_id);