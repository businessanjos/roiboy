-- Add sector_id to playbook_folders
ALTER TABLE public.playbook_folders 
ADD COLUMN sector_id text;

-- Add sector_id to playbook_items
ALTER TABLE public.playbook_items 
ADD COLUMN sector_id text;

-- Create indexes for better performance
CREATE INDEX idx_playbook_folders_sector ON public.playbook_folders(account_id, sector_id);
CREATE INDEX idx_playbook_items_sector ON public.playbook_items(account_id, sector_id);

-- Update RLS policies for playbook_folders to include sector filtering
DROP POLICY IF EXISTS "Users can manage their account playbook folders" ON public.playbook_folders;
CREATE POLICY "Users can manage their account playbook folders" ON public.playbook_folders
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Update RLS policies for playbook_items to include sector filtering
DROP POLICY IF EXISTS "Users can manage their account playbook items" ON public.playbook_items;
CREATE POLICY "Users can manage their account playbook items" ON public.playbook_items
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM public.users WHERE id = auth.uid()
    )
  );