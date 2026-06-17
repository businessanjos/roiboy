
-- 1. Função que libera todas as conversas abertas de um usuário e desativa o agente
CREATE OR REPLACE FUNCTION public.release_zapp_assignments_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desativa o agente no RoyZapp
  UPDATE public.zapp_agents
     SET is_active = false,
         is_online = false,
         updated_at = now()
   WHERE user_id = _user_id
     AND is_active = true;

  -- Libera todas as conversas abertas para a fila
  UPDATE public.zapp_conversation_assignments za
     SET agent_id = NULL,
         status = 'triage',
         updated_at = now()
    FROM public.zapp_agents zag
   WHERE za.agent_id = zag.id
     AND zag.user_id = _user_id
     AND za.status <> 'closed';
END;
$$;

-- 2. Trigger: ao desativar usuário, libera conversas automaticamente
CREATE OR REPLACE FUNCTION public.trg_on_user_deactivated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_active, true) = true AND COALESCE(NEW.is_active, true) = false THEN
    PERFORM public.release_zapp_assignments_for_user(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_deactivated_release_zapp ON public.users;
CREATE TRIGGER on_user_deactivated_release_zapp
AFTER UPDATE OF is_active ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.trg_on_user_deactivated();

-- 3. Trigger: bloqueia atribuir conversas a agentes inativos / usuários inativos
CREATE OR REPLACE FUNCTION public.trg_block_inactive_agent_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_active boolean;
  v_user_active boolean;
BEGIN
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pula validação se o agent_id não mudou em UPDATE (evita falhas em updates de status/metadata)
  IF TG_OP = 'UPDATE' AND OLD.agent_id IS NOT DISTINCT FROM NEW.agent_id THEN
    RETURN NEW;
  END IF;

  SELECT zag.is_active, COALESCE(u.is_active, true)
    INTO v_agent_active, v_user_active
    FROM public.zapp_agents zag
    LEFT JOIN public.users u ON u.id = zag.user_id
   WHERE zag.id = NEW.agent_id;

  IF v_agent_active IS DISTINCT FROM true OR v_user_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Não é possível atribuir conversa a um atendente desativado (agent_id=%)', NEW.agent_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_inactive_agent_assignment ON public.zapp_conversation_assignments;
CREATE TRIGGER block_inactive_agent_assignment
BEFORE INSERT OR UPDATE OF agent_id ON public.zapp_conversation_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_inactive_agent_assignment();

-- 4. Backfill: libera tudo que já está preso a usuários inativos
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE is_active = false LOOP
    PERFORM public.release_zapp_assignments_for_user(r.id);
  END LOOP;
END $$;
