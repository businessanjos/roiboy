-- Drop existing broken policies on marketing_task_sections
DROP POLICY IF EXISTS "Users can view their account sections" ON public.marketing_task_sections;
DROP POLICY IF EXISTS "Users can create sections for their account" ON public.marketing_task_sections;
DROP POLICY IF EXISTS "Users can update their account sections" ON public.marketing_task_sections;
DROP POLICY IF EXISTS "Users can delete their account sections" ON public.marketing_task_sections;

-- Recreate policies using get_my_account_id() function (correct approach)
CREATE POLICY "Users can view their account sections"
  ON public.marketing_task_sections FOR SELECT
  USING (
    account_id = get_my_account_id()
    OR is_super_admin()
    OR is_account_owner()
  );

CREATE POLICY "Users can create sections for their account"
  ON public.marketing_task_sections FOR INSERT
  WITH CHECK (
    account_id = get_my_account_id()
    OR is_super_admin()
    OR is_account_owner()
  );

CREATE POLICY "Users can update their account sections"
  ON public.marketing_task_sections FOR UPDATE
  USING (
    account_id = get_my_account_id()
    OR is_super_admin()
    OR is_account_owner()
  );

CREATE POLICY "Users can delete their account sections"
  ON public.marketing_task_sections FOR DELETE
  USING (
    account_id = get_my_account_id()
    OR is_super_admin()
    OR is_account_owner()
  );