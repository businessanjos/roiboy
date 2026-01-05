-- Fix RLS policies for internal chat tables to use consistent functions

-- 1. Fix internal_chats INSERT policy
DROP POLICY IF EXISTS "Users can create chats in their account" ON public.internal_chats;

CREATE POLICY "Users can create chats in their account" 
ON public.internal_chats 
FOR INSERT 
TO authenticated
WITH CHECK (account_id = get_user_account_id());

-- 2. Fix internal_chat_participants INSERT policy
DROP POLICY IF EXISTS "Users can add participants to chats they created" ON public.internal_chat_participants;

CREATE POLICY "Users can add participants to chats they created"
ON public.internal_chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM internal_chats c
    WHERE c.id = chat_id 
    AND c.account_id = get_user_account_id()
  )
  OR user_id = get_current_user_id()
);

-- 3. Fix internal_messages INSERT policy
DROP POLICY IF EXISTS "Users can send messages to their chats" ON public.internal_messages;

CREATE POLICY "Users can send messages to their chats"
ON public.internal_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = get_current_user_id()
  AND EXISTS (
    SELECT 1 FROM internal_chat_participants
    WHERE chat_id = internal_messages.chat_id
    AND user_id = get_current_user_id()
  )
);