
-- 1. Add edit tracking columns to form_responses
ALTER TABLE public.form_responses 
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES public.users(id);

-- 2. Link Matheus Krey's response directly
UPDATE public.form_responses 
SET client_id = '5dc0ec45-f0f5-4fa4-8bea-1d8e3c2f2f4e'
WHERE id = '7e826cad-9e0e-4c60-8d14-df8a7b1df3e0'
  AND client_id IS NULL;

-- 3. Link ALL orphaned responses by matching phone (last 8+ digits)
UPDATE public.form_responses fr
SET client_id = matched.client_id
FROM (
  SELECT DISTINCT ON (fr2.id) 
    fr2.id AS response_id,
    c.id AS client_id
  FROM public.form_responses fr2
  JOIN public.clients c 
    ON c.account_id = fr2.account_id
    AND RIGHT(REGEXP_REPLACE(c.phone_e164, '[^0-9]', '', 'g'), 8) = RIGHT(REGEXP_REPLACE(fr2.client_phone, '[^0-9]', '', 'g'), 8)
    AND LENGTH(REGEXP_REPLACE(fr2.client_phone, '[^0-9]', '', 'g')) >= 8
  WHERE fr2.client_id IS NULL
    AND fr2.client_phone IS NOT NULL
    AND fr2.client_phone != ''
) matched
WHERE fr.id = matched.response_id
  AND fr.client_id IS NULL;

-- 4. Allow users to update form_responses they have access to (for editing)
CREATE POLICY "Users can update form responses in their account"
  ON public.form_responses
  FOR UPDATE
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());
