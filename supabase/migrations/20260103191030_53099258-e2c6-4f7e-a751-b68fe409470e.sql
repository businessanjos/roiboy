
-- Add policy to allow account admins to insert users in their account
CREATE POLICY "Account admins can insert users in their account"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  account_id = get_user_account_id()
  AND is_account_owner()
);
