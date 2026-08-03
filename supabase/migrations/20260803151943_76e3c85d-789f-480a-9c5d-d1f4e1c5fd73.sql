CREATE OR REPLACE FUNCTION public.auto_route_client_conversation_to_cs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conv           record;
  v_assignment     record;
  v_sales_dept     uuid;
  v_cs_dept        uuid;
  v_text           text;
  v_agent_id       uuid;
  v_responsible    uuid;
BEGIN
  IF NEW.direction <> 'client_to_team'::message_direction THEN
    RETURN NEW;
  END IF;

  v_text := lower(coalesce(NEW.content, NEW.transcription, ''));
  IF v_text = '' THEN
    RETURN NEW;
  END IF;

  -- Contexto de suporte / CS
  IF v_text !~ '(nao consigo|não consigo|nao estou conseguindo|não estou conseguindo|suporte|acesso|acessar|senha|login|plataforma|aula|mentoria|encontro presencial|certificado|material|grupo|boleto|segunda via|nota fiscal|cancelar|atendimento|ajuda)' THEN
    RETURN NEW;
  END IF;

  SELECT id, account_id, client_id, deal_id
    INTO v_conv
  FROM public.zapp_conversations
  WHERE id = NEW.zapp_conversation_id;

  -- Só clientes já convertidos
  IF v_conv.id IS NULL OR v_conv.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Não mexer se existe negociação em aberto vinculada
  IF v_conv.deal_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = v_conv.deal_id
      AND d.deleted_at IS NULL
      AND coalesce(d.status, 'open') NOT IN ('won', 'lost')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_sales_dept
  FROM public.zapp_departments
  WHERE account_id = v_conv.account_id AND sector_id = 'vendas'
  LIMIT 1;

  SELECT id INTO v_cs_dept
  FROM public.zapp_departments
  WHERE account_id = v_conv.account_id AND sector_id = 'operacoes'
  LIMIT 1;

  IF v_sales_dept IS NULL OR v_cs_dept IS NULL THEN
    RETURN NEW;
  END IF;

  -- Assignment aberto na fila do Comercial
  SELECT * INTO v_assignment
  FROM public.zapp_conversation_assignments
  WHERE zapp_conversation_id = v_conv.id
    AND department_id = v_sales_dept
    AND status <> 'closed'::zapp_assignment_status
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_assignment.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Já existe ticket aberto no CS? Então apenas fecha o do Comercial.
  IF EXISTS (
    SELECT 1 FROM public.zapp_conversation_assignments
    WHERE zapp_conversation_id = v_conv.id
      AND department_id = v_cs_dept
      AND status <> 'closed'::zapp_assignment_status
  ) THEN
    UPDATE public.zapp_conversation_assignments
    SET status = 'closed'::zapp_assignment_status,
        closed_at = now(),
        close_notes = 'Fechado automaticamente: cliente já atendido pelo Customer Success'
    WHERE id = v_assignment.id;
    RETURN NEW;
  END IF;

  SELECT responsible_user_id INTO v_responsible
  FROM public.clients WHERE id = v_conv.client_id;

  IF v_responsible IS NOT NULL THEN
    SELECT a.id INTO v_agent_id
    FROM public.zapp_agents a
    WHERE a.user_id = v_responsible
      AND a.account_id = v_conv.account_id
      AND a.is_active = true
      AND (a.department_id = v_cs_dept OR a.department_id IS NULL)
    LIMIT 1;
  END IF;

  UPDATE public.zapp_conversation_assignments
  SET department_id = v_cs_dept,
      agent_id = v_agent_id,
      status = CASE WHEN v_agent_id IS NULL
                    THEN 'triage'::zapp_assignment_status
                    ELSE 'active'::zapp_assignment_status END,
      assigned_at = now(),
      updated_at = now()
  WHERE id = v_assignment.id;

  INSERT INTO public.zapp_transfers (
    account_id, conversation_id, from_agent_id, to_agent_id,
    from_department_id, to_department_id, reason, transferred_at
  ) VALUES (
    v_conv.account_id, v_conv.id, v_assignment.agent_id, v_agent_id,
    v_sales_dept, v_cs_dept,
    'Roteamento automático: cliente ativo com contexto de suporte/CS', now()
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_route_client_conversation_to_cs ON public.zapp_messages;
CREATE TRIGGER trg_auto_route_client_conversation_to_cs
AFTER INSERT ON public.zapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_route_client_conversation_to_cs();