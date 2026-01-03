
-- Allow account owners to update users within their account
CREATE POLICY "Account admins can update users in their account"
ON public.users
FOR UPDATE
USING (
  account_id = get_user_account_id() 
  AND is_account_owner()
)
WITH CHECK (
  account_id = get_user_account_id() 
  AND is_account_owner()
);
