-- Create table for conversation tags
CREATE TABLE public.zapp_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7c85',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for conversation-tag relationships
CREATE TABLE public.zapp_conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.zapp_conversation_assignments(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.zapp_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(assignment_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.zapp_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_conversation_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for zapp_tags
CREATE POLICY "Users can view tags in their account"
ON public.zapp_tags FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert tags in their account"
ON public.zapp_tags FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update tags in their account"
ON public.zapp_tags FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete tags in their account"
ON public.zapp_tags FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS policies for zapp_conversation_tags
CREATE POLICY "Users can view conversation tags in their account"
ON public.zapp_conversation_tags FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert conversation tags in their account"
ON public.zapp_conversation_tags FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete conversation tags in their account"
ON public.zapp_conversation_tags FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_zapp_tags_account ON public.zapp_tags(account_id);
CREATE INDEX idx_zapp_conversation_tags_assignment ON public.zapp_conversation_tags(assignment_id);
CREATE INDEX idx_zapp_conversation_tags_tag ON public.zapp_conversation_tags(tag_id);