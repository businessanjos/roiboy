
-- Drop incorrect policies
DROP POLICY IF EXISTS "Users can view pipelines of their account" ON public.pipelines;
DROP POLICY IF EXISTS "Users can insert pipelines for their account" ON public.pipelines;
DROP POLICY IF EXISTS "Users can update pipelines of their account" ON public.pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines of their account" ON public.pipelines;

-- Recreate with correct auth check
CREATE POLICY "Users can view pipelines of their account"
ON public.pipelines FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert pipelines for their account"
ON public.pipelines FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update pipelines of their account"
ON public.pipelines FOR UPDATE TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete pipelines of their account"
ON public.pipelines FOR DELETE TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
