-- Tabela de conversas internas entre usuários do time
CREATE TABLE public.internal_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT, -- Para chats em grupo (opcional)
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes do chat
CREATE TABLE public.internal_chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(chat_id, user_id)
);

-- Mensagens do chat interno
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.internal_messages(id),
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_internal_chats_account ON public.internal_chats(account_id);
CREATE INDEX idx_internal_chat_participants_user ON public.internal_chat_participants(user_id);
CREATE INDEX idx_internal_chat_participants_chat ON public.internal_chat_participants(chat_id);
CREATE INDEX idx_internal_messages_chat ON public.internal_messages(chat_id);
CREATE INDEX idx_internal_messages_sender ON public.internal_messages(sender_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para internal_chats
CREATE POLICY "Users can view chats they participate in"
ON public.internal_chats FOR SELECT
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.internal_chat_participants
    WHERE chat_id = internal_chats.id
    AND user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Users can create chats in their account"
ON public.internal_chats FOR INSERT
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Chat creator can update"
ON public.internal_chats FOR UPDATE
USING (
  created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- RLS Policies para participants
CREATE POLICY "Users can view participants of their chats"
ON public.internal_chat_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_participants p
    WHERE p.chat_id = internal_chat_participants.chat_id
    AND p.user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Users can add participants to chats they created"
ON public.internal_chat_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_chats c
    WHERE c.id = chat_id
    AND c.created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
  OR user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their own participation"
ON public.internal_chat_participants FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- RLS Policies para messages
CREATE POLICY "Users can view messages in their chats"
ON public.internal_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_participants
    WHERE chat_id = internal_messages.chat_id
    AND user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages to their chats"
ON public.internal_messages FOR INSERT
WITH CHECK (
  sender_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.internal_chat_participants
    WHERE chat_id = internal_messages.chat_id
    AND user_id = sender_id
  )
);

CREATE POLICY "Users can edit their own messages"
ON public.internal_messages FOR UPDATE
USING (
  sender_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;

-- Trigger para notificar novos mensagens
CREATE OR REPLACE FUNCTION public.notify_internal_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_sender_name TEXT;
  v_chat_name TEXT;
BEGIN
  -- Get sender name
  SELECT name INTO v_sender_name FROM public.users WHERE id = NEW.sender_id;
  
  -- Get chat name or other participant name for 1:1
  SELECT COALESCE(c.name, u.name) INTO v_chat_name
  FROM public.internal_chats c
  LEFT JOIN public.internal_chat_participants p ON p.chat_id = c.id AND p.user_id != NEW.sender_id
  LEFT JOIN public.users u ON u.id = p.user_id
  WHERE c.id = NEW.chat_id
  LIMIT 1;
  
  -- Notify all participants except sender
  FOR v_participant IN 
    SELECT p.user_id, u.account_id
    FROM public.internal_chat_participants p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.chat_id = NEW.chat_id
    AND p.user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (
      account_id,
      user_id,
      type,
      title,
      content,
      link,
      source_type,
      source_id,
      triggered_by_user_id
    ) VALUES (
      v_participant.account_id,
      v_participant.user_id,
      'internal_message',
      'Nova mensagem de ' || v_sender_name,
      LEFT(NEW.content, 100),
      '/team-chat/' || NEW.chat_id,
      'internal_chat',
      NEW.id,
      NEW.sender_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_internal_message_created
  AFTER INSERT ON public.internal_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_internal_message();