-- Add visibility column to playbook_items table
ALTER TABLE public.playbook_items 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'sector';

-- Add check constraint for visibility values
ALTER TABLE public.playbook_items 
ADD CONSTRAINT playbook_items_visibility_check 
CHECK (visibility IN ('personal', 'sector'));

-- Add visibility column to playbook_folders table
ALTER TABLE public.playbook_folders 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'sector';

-- Add check constraint for visibility values
ALTER TABLE public.playbook_folders 
ADD CONSTRAINT playbook_folders_visibility_check 
CHECK (visibility IN ('personal', 'sector'));

-- Drop existing select policies and recreate with visibility filter
DROP POLICY IF EXISTS "Users can view playbook items" ON public.playbook_items;
DROP POLICY IF EXISTS "Users can view own account playbook items" ON public.playbook_items;

CREATE POLICY "Users can view playbook items"
ON public.playbook_items FOR SELECT
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  AND (
    visibility = 'sector' 
    OR (visibility = 'personal' AND created_by = auth.uid())
  )
);

-- Drop existing select policies for folders and recreate
DROP POLICY IF EXISTS "Users can view playbook folders" ON public.playbook_folders;
DROP POLICY IF EXISTS "Users can view own account playbook folders" ON public.playbook_folders;

CREATE POLICY "Users can view playbook folders"
ON public.playbook_folders FOR SELECT
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  AND (
    visibility = 'sector' 
    OR (visibility = 'personal' AND created_by = auth.uid())
  )
);