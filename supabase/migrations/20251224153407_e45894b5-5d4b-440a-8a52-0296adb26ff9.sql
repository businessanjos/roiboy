-- Adicionar campo needs_human_attention para escalonamento
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS needs_human_attention boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
ADD COLUMN IF NOT EXISTS escalation_reason text,
ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
ADD COLUMN IF NOT EXISTS avg_response_time_seconds integer;

-- Criar tabela de base de conhecimento para suporte
CREATE TABLE public.support_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  keywords text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para knowledge base (apenas super admins podem gerenciar)
ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage knowledge base"
ON public.support_knowledge_base
FOR ALL
USING (public.is_super_admin());

-- Trigger para updated_at
CREATE TRIGGER update_support_knowledge_base_updated_at
  BEFORE UPDATE ON public.support_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir alguns artigos iniciais da base de conhecimento
INSERT INTO public.support_knowledge_base (title, content, category, keywords) VALUES
('Como limpar cache do navegador', 
'Para limpar o cache do navegador:\n\n**Chrome:**\n1. Pressione Ctrl+Shift+Delete\n2. Selecione "Imagens e arquivos em cache"\n3. Clique em "Limpar dados"\n\n**Firefox:**\n1. Pressione Ctrl+Shift+Delete\n2. Selecione "Cache"\n3. Clique em "Limpar agora"\n\n**Safari:**\n1. Vá em Safari > Preferências > Avançado\n2. Marque "Mostrar menu Desenvolver"\n3. Vá em Desenvolver > Esvaziar caches', 
'troubleshooting', 
ARRAY['cache', 'limpar', 'navegador', 'chrome', 'firefox', 'safari', 'lento']),

('Como cadastrar um novo cliente',
'Para cadastrar um novo cliente:\n\n1. Acesse o menu "Clientes"\n2. Clique no botão "+ Novo Cliente"\n3. Preencha os dados obrigatórios (nome e telefone)\n4. Opcionalmente, adicione tags para segmentação\n5. Clique em "Salvar"\n\n💡 **Dica:** Cadastre também a data de aniversário para receber lembretes automáticos!',
'clientes',
ARRAY['cliente', 'cadastrar', 'novo', 'adicionar', 'criar']),

('Como conectar WhatsApp',
'Para conectar seu WhatsApp:\n\n1. Acesse "Integrações" no menu\n2. Clique em "Conectar WhatsApp"\n3. Escaneie o QR Code com seu celular\n4. Aguarde a confirmação de conexão\n\n⚠️ **Importante:** Mantenha seu celular conectado à internet para a integração funcionar.',
'integracoes',
ARRAY['whatsapp', 'conectar', 'qr', 'code', 'integração']),

('Como criar um evento',
'Para criar um evento:\n\n1. Acesse o menu "Eventos"\n2. Clique em "+ Novo Evento"\n3. Preencha título, data e horário\n4. Escolha a modalidade (presencial/online)\n5. Adicione participantes ou produtos vinculados\n6. Salve o evento\n\n💡 **Dica:** Use o check-in por QR Code para registrar presença automaticamente!',
'eventos',
ARRAY['evento', 'criar', 'agendar', 'live', 'reunião']),

('Erro de página em branco',
'Se você está vendo uma página em branco:\n\n1. **Atualize a página** (F5 ou Ctrl+R)\n2. **Limpe o cache** do navegador\n3. **Tente outro navegador** (Chrome, Firefox, Edge)\n4. **Verifique sua conexão** com a internet\n5. **Desative extensões** do navegador temporariamente\n\nSe o problema persistir, envie uma captura de tela para nossa equipe!',
'troubleshooting',
ARRAY['branco', 'página', 'erro', 'não carrega', 'vazio']);

-- Função para notificar super admins sobre novos tickets
CREATE OR REPLACE FUNCTION public.notify_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_super_admin RECORD;
BEGIN
  -- Notificar todos os super admins
  FOR v_super_admin IN 
    SELECT sa.user_id, u.account_id
    FROM public.super_admins sa
    JOIN public.users u ON u.id = sa.user_id
  LOOP
    INSERT INTO public.notifications (
      account_id,
      user_id,
      type,
      title,
      content,
      link,
      source_type,
      source_id
    ) VALUES (
      v_super_admin.account_id,
      v_super_admin.user_id,
      'support_ticket',
      'Novo ticket de suporte',
      'Novo ticket de ' || COALESCE(NEW.client_name, NEW.client_phone) || ': ' || COALESCE(NEW.subject, 'Sem assunto'),
      '/admin?tab=suporte',
      'support_ticket',
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Trigger para novos tickets
DROP TRIGGER IF EXISTS on_support_ticket_created ON public.support_tickets;
CREATE TRIGGER on_support_ticket_created
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_ticket();

-- Função para notificar quando ticket é escalonado
CREATE OR REPLACE FUNCTION public.notify_support_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_super_admin RECORD;
BEGIN
  -- Notificar apenas se needs_human_attention mudou para true
  IF NEW.needs_human_attention = true AND (OLD.needs_human_attention IS NULL OR OLD.needs_human_attention = false) THEN
    FOR v_super_admin IN 
      SELECT sa.user_id, u.account_id
      FROM public.super_admins sa
      JOIN public.users u ON u.id = sa.user_id
    LOOP
      INSERT INTO public.notifications (
        account_id,
        user_id,
        type,
        title,
        content,
        link,
        source_type,
        source_id
      ) VALUES (
        v_super_admin.account_id,
        v_super_admin.user_id,
        'support_escalation',
        '⚠️ Ticket escalonado para atendimento humano',
        'Ticket de ' || COALESCE(NEW.client_name, NEW.client_phone) || ' precisa de atenção: ' || COALESCE(NEW.escalation_reason, 'Sem motivo especificado'),
        '/admin?tab=suporte',
        'support_ticket',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Trigger para escalonamento
DROP TRIGGER IF EXISTS on_support_ticket_escalated ON public.support_tickets;
CREATE TRIGGER on_support_ticket_escalated
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_escalation();