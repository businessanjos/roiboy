-- Add columns for sharing and panel type
ALTER TABLE public.insights_layouts 
ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';

ALTER TABLE public.insights_layouts 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'dashboard';

-- Drop existing SELECT policy and create new one that includes shared access
DROP POLICY IF EXISTS "Users can view own layouts" ON insights_layouts;

CREATE POLICY "Users can view own or shared layouts"
  ON insights_layouts FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() = ANY(shared_with)
  );