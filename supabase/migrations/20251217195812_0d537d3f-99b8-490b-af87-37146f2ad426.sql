-- Create table for followup reactions
CREATE TABLE public.followup_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  followup_id uuid NOT NULL REFERENCES public.client_followups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(followup_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.followup_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view reactions in their account"
ON public.followup_reactions FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert reactions in their account"
ON public.followup_reactions FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete their own reactions"
ON public.followup_reactions FOR DELETE
USING (account_id = get_user_account_id() AND user_id IN (SELECT id FROM public.users WHERE account_id = get_user_account_id()));

-- Index for faster lookups
CREATE INDEX idx_followup_reactions_followup_id ON public.followup_reactions(followup_id);