-- Tabela para configuração global do assistente de IA (Anjo Zad)
CREATE TABLE public.ai_assistant_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Anjo Zad',
  display_name TEXT NOT NULL DEFAULT 'Arcanjo Zadkiel',
  description TEXT DEFAULT 'Anjo da misericórdia e da benevolência, conhecido por intervir em situações difíceis',
  avatar_url TEXT,
  personality TEXT DEFAULT 'Você é Zad, um assistente compassivo e sábio. Sua missão é ajudar os usuários com bondade e paciência, oferecendo orientação clara e empática.',
  system_prompt TEXT DEFAULT 'Você é o Anjo Zad (Arcanjo Zadkiel), um assistente de IA para a plataforma Roy CX. Você ajuda os usuários com suas dúvidas sobre clientes, eventos, finanças e uso do sistema. Seja sempre gentil, claro e prestativo.',
  greeting_message TEXT DEFAULT 'Olá! Sou o Anjo Zad, estou aqui para ajudar você. Como posso ser útil hoje?',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  features JSONB DEFAULT '{"canSearchClients": true, "canSearchEvents": true, "canAnswerFinancial": true, "canSuggestActions": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default configuration
INSERT INTO public.ai_assistant_config (name, display_name, description)
VALUES ('Anjo Zad', 'Arcanjo Zadkiel', 'Anjo da misericórdia e da benevolência, conhecido por intervir em situações difíceis');

-- Enable RLS
ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage the assistant config
CREATE POLICY "Super admins can manage AI assistant config"
  ON public.ai_assistant_config
  FOR ALL
  USING (is_super_admin());

-- Everyone can read the config (for the assistant to work)
CREATE POLICY "Anyone can read AI assistant config"
  ON public.ai_assistant_config
  FOR SELECT
  USING (true);