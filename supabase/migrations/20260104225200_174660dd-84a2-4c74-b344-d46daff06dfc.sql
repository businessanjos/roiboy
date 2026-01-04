
-- Create security definer function to check if user is participant of a chat
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM internal_chat_participants
    WHERE chat_id = p_chat_id
      AND user_id = p_user_id
  )
$$;

-- Create security definer function to get current user's internal ID
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Drop the problematic SELECT policy on internal_chat_participants
DROP POLICY IF EXISTS "Users can view participants of their chats" ON internal_chat_participants;

-- Create new SELECT policy without recursion
CREATE POLICY "Users can view participants of their chats" 
ON internal_chat_participants 
FOR SELECT 
USING (
  public.is_chat_participant(chat_id, public.get_current_user_id())
);

-- Also fix the INSERT policy to use the security definer function
DROP POLICY IF EXISTS "Users can add participants to chats they created" ON internal_chat_participants;

CREATE POLICY "Users can add participants to chats they created" 
ON internal_chat_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM internal_chats c
    WHERE c.id = chat_id 
    AND c.created_by = public.get_current_user_id()
  )
  OR user_id = public.get_current_user_id()
);

-- Fix UPDATE policy 
DROP POLICY IF EXISTS "Users can update their own participation" ON internal_chat_participants;

CREATE POLICY "Users can update their own participation" 
ON internal_chat_participants 
FOR UPDATE 
USING (user_id = public.get_current_user_id());

-- Add DELETE policy for leaving chats
DROP POLICY IF EXISTS "Users can leave chats" ON internal_chat_participants;

CREATE POLICY "Users can leave chats" 
ON internal_chat_participants 
FOR DELETE 
USING (user_id = public.get_current_user_id());
