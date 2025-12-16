-- Allow users to update their own account name
CREATE POLICY "Users can update their account"
ON public.accounts
FOR UPDATE
USING (id = get_user_account_id())
WITH CHECK (id = get_user_account_id());