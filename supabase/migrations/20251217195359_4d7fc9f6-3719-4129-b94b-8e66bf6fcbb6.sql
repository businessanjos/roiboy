-- Add parent_id column for reply threading on client_followups
ALTER TABLE public.client_followups
ADD COLUMN parent_id uuid REFERENCES public.client_followups(id) ON DELETE CASCADE;

-- Add index for faster parent lookups
CREATE INDEX idx_client_followups_parent_id ON public.client_followups(parent_id);