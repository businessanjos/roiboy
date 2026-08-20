CREATE TABLE public.contact_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_channels TO authenticated;
GRANT ALL ON public.contact_channels TO service_role;

ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_channels_select" ON public.contact_channels
FOR SELECT TO authenticated
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "contact_channels_insert" ON public.contact_channels
FOR INSERT TO authenticated
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "contact_channels_update" ON public.contact_channels
FOR UPDATE TO authenticated
USING (account_id = public.get_current_user_account_id())
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "contact_channels_delete" ON public.contact_channels
FOR DELETE TO authenticated
USING (account_id = public.get_current_user_account_id());