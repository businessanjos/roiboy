-- Create insights_layouts table for saving user dashboard configurations
CREATE TABLE public.insights_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Meu Painel',
  layout JSONB NOT NULL DEFAULT '[]',
  widgets JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_insights_layouts_user ON public.insights_layouts(user_id);
CREATE INDEX idx_insights_layouts_account ON public.insights_layouts(account_id);

-- Enable RLS
ALTER TABLE public.insights_layouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own layouts"
  ON public.insights_layouts FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create their own layouts"
  ON public.insights_layouts FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their own layouts"
  ON public.insights_layouts FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their own layouts"
  ON public.insights_layouts FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_insights_layouts_updated_at
  BEFORE UPDATE ON public.insights_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();