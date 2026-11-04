ALTER TABLE public.playbook_sequence_steps ALTER COLUMN playbook_item_id DROP NOT NULL;
ALTER TABLE public.playbook_sequence_steps ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES public.zapp_tags(id) ON DELETE CASCADE;
ALTER TABLE public.zapp_sequence_run_steps ADD COLUMN IF NOT EXISTS tag_id uuid;