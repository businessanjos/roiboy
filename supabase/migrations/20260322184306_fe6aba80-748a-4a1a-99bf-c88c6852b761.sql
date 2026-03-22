-- Add SELECT policy for chat creators so they can read the chat immediately after insert
CREATE POLICY "Chat creator can select own chats"
ON public.internal_chats
FOR SELECT
USING (created_by = get_current_user_id());

-- Drop duplicate INSERT policy on internal_chat_participants
DROP POLICY IF EXISTS "Users can add participants to chats they created" ON public.internal_chat_participants;