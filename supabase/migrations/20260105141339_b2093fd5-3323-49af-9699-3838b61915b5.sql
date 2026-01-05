-- Fix helper functions for internal chat RLS - set search_path = '' to bypass RLS

-- 1. Recreate get_current_user_id with empty search_path
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- 2. Recreate is_chat_participant with empty search_path
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_participants
    WHERE chat_id = p_chat_id AND user_id = p_user_id
  )
$$;

-- 3. Recreate user_is_chat_member with empty search_path
CREATE OR REPLACE FUNCTION public.user_is_chat_member(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_participants icp
    JOIN public.users u ON u.id = icp.user_id
    WHERE icp.chat_id = p_chat_id AND u.auth_user_id = auth.uid()
  )
$$;

-- 4. Fix INSERT policy for internal_chats
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;
CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (
  account_id = public.get_my_account_id() 
  AND created_by = public.get_current_user_id()
);

-- 5. Fix SELECT policy for internal_chats  
DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.internal_chats;
CREATE POLICY "Users can view chats they participate in" 
ON public.internal_chats 
FOR SELECT 
TO authenticated
USING (public.user_is_chat_member(id));

-- 6. Fix INSERT policy for internal_chat_participants
DROP POLICY IF EXISTS "Users can add participants to their chats" ON public.internal_chat_participants;
CREATE POLICY "Users can add participants to chats" 
ON public.internal_chat_participants 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_chats c
    WHERE c.id = chat_id 
    AND c.account_id = public.get_my_account_id()
  )
);

-- 7. Fix SELECT policy for internal_chat_participants
DROP POLICY IF EXISTS "Users can view participants of their chats" ON public.internal_chat_participants;
CREATE POLICY "Users can view participants of their chats" 
ON public.internal_chat_participants 
FOR SELECT 
TO authenticated
USING (public.user_is_chat_member(chat_id));

-- 8. Fix policies for internal_messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.internal_messages;
CREATE POLICY "Users can view messages in their chats" 
ON public.internal_messages 
FOR SELECT 
TO authenticated
USING (public.user_is_chat_member(chat_id));

DROP POLICY IF EXISTS "Users can send messages to their chats" ON public.internal_messages;
CREATE POLICY "Users can send messages to their chats" 
ON public.internal_messages 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.user_is_chat_member(chat_id) 
  AND sender_id = public.get_current_user_id()
);