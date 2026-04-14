
-- Drop old policies
DROP POLICY IF EXISTS "Users can view hr_departments of their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can insert hr_departments in their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can update hr_departments in their account" ON public.hr_departments;
DROP POLICY IF EXISTS "Users can delete hr_departments in their account" ON public.hr_departments;

-- Recreate with get_my_account_id()
CREATE POLICY "Users can view hr_departments of their account"
ON public.hr_departments FOR SELECT
USING (account_id = get_my_account_id());

CREATE POLICY "Users can insert hr_departments in their account"
ON public.hr_departments FOR INSERT
WITH CHECK (account_id = get_my_account_id());

CREATE POLICY "Users can update hr_departments in their account"
ON public.hr_departments FOR UPDATE
USING (account_id = get_my_account_id());

CREATE POLICY "Users can delete hr_departments in their account"
ON public.hr_departments FOR DELETE
USING (account_id = get_my_account_id());
