-- Create pipeline_filters table for custom filters
CREATE TABLE public.pipeline_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  match_type TEXT NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_filters ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own filters and public filters from same account
CREATE POLICY "Users can view own and public filters"
ON public.pipeline_filters FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  AND (created_by = auth.uid() OR is_public = true)
);

-- Policy: Users can create filters in their account
CREATE POLICY "Users can create filters"
ON public.pipeline_filters FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  AND created_by = auth.uid()
);

-- Policy: Users can update their own filters
CREATE POLICY "Users can update own filters"
ON public.pipeline_filters FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own filters
CREATE POLICY "Users can delete own filters"
ON public.pipeline_filters FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_pipeline_filters_updated_at
BEFORE UPDATE ON public.pipeline_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();