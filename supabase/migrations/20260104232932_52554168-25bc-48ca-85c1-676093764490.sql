-- Create a helper function to check if user is participant of a chat
-- This breaks the recursion by being SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.user_is_chat_member(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM internal_chat_participants icp
    JOIN users u ON u.id = icp.user_id
    WHERE icp.chat_id = p_chat_id
      AND u.auth_user_id = auth.uid()
  )
$$;

-- Drop and recreate the SELECT policy using the helper function
DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.internal_chats;

CREATE POLICY "Users can view chats they participate in"
ON public.internal_chats
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  AND public.user_is_chat_member(id)
);