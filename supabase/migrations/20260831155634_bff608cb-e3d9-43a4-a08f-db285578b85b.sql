CREATE TABLE IF NOT EXISTS public.zapp_internal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_internal_contacts TO authenticated;
GRANT ALL ON public.zapp_internal_contacts TO service_role;
ALTER TABLE public.zapp_internal_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal contacts by account" ON public.zapp_internal_contacts;
CREATE POLICY "internal contacts by account" ON public.zapp_internal_contacts
FOR ALL TO authenticated
USING (account_id = public.get_current_user_account_id())
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE OR REPLACE FUNCTION public.zapp_is_internal_contact(_account uuid, _phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(regexp_replace(_phone, '\D', '', 'g')) < 8 THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.zapp_internal_contacts i
      WHERE i.account_id = _account
        AND right(regexp_replace(i.phone_e164, '\D', '', 'g'), 8) = right(regexp_replace(_phone, '\D', '', 'g'), 8)
    ) OR EXISTS (
      SELECT 1 FROM public.hr_collaborators h
      WHERE h.account_id = _account
        AND h.phone IS NOT NULL
        AND right(regexp_replace(h.phone, '\D', '', 'g'), 8) = right(regexp_replace(_phone, '\D', '', 'g'), 8)
    )
  END;
$$;

INSERT INTO public.zapp_internal_contacts (account_id, phone_e164, label)
SELECT DISTINCT c.account_id, c.phone_e164, c.contact_name
FROM public.zapp_conversations c
WHERE c.phone_e164 IN ('+5543999540408', '+554399540408', '+5543998154190')
  AND NOT EXISTS (
    SELECT 1 FROM public.zapp_internal_contacts i
    WHERE i.account_id = c.account_id
      AND right(regexp_replace(i.phone_e164, '\D', '', 'g'), 8) = right(regexp_replace(c.phone_e164, '\D', '', 'g'), 8)
  );

DO $do$
DECLARE d text; fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['zapp_productivity_metrics','zapp_productivity_contacts'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = fn
    LIMIT 1;

    IF d IS NULL OR position('zapp_is_internal_contact' in d) > 0 THEN
      CONTINUE;
    END IF;

    d := replace(
      d,
      'AND (_include_groups OR coalesce(c.is_group, false) = false)',
      'AND (_include_groups OR coalesce(c.is_group, false) = false)
      AND NOT public.zapp_is_internal_contact(_account, c.phone_e164)'
    );
    EXECUTE d;
  END LOOP;
END
$do$;