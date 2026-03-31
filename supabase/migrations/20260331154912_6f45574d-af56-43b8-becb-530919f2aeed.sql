DROP POLICY IF EXISTS "Users can view conversation tags in their account" ON public.zapp_conversation_tags;
DROP POLICY IF EXISTS "Users can insert conversation tags in their account" ON public.zapp_conversation_tags;
DROP POLICY IF EXISTS "Users can delete conversation tags in their account" ON public.zapp_conversation_tags;

CREATE POLICY "Users can view conversation tags in their account"
ON public.zapp_conversation_tags
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND account_id = public.get_user_account_id()
);

CREATE POLICY "Users can insert conversation tags in their account"
ON public.zapp_conversation_tags
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND account_id = public.get_user_account_id()
);

CREATE POLICY "Users can delete conversation tags in their account"
ON public.zapp_conversation_tags
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND account_id = public.get_user_account_id()
);