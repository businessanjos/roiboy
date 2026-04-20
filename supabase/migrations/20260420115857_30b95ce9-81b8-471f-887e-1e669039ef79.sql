-- Permitir que usuários excluam videochamadas da própria conta
CREATE POLICY "Users can delete video calls in their account"
ON public.video_call_sessions
FOR DELETE
TO authenticated
USING (account_id = get_my_account_id());