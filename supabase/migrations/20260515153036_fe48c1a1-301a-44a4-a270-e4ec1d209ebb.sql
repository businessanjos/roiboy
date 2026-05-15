-- Trigger to auto-assign new zapp_conversations to the client's responsible consultant (hybrid model)
CREATE OR REPLACE FUNCTION public.auto_assign_zapp_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsible_user_id uuid;
  v_agent_id uuid;
BEGIN
  -- Only auto-assign when conversation is linked to a client
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find client's responsible consultant
  SELECT responsible_user_id INTO v_responsible_user_id
  FROM public.clients
  WHERE id = NEW.client_id
  LIMIT 1;

  IF v_responsible_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the corresponding zapp_agent in this account
  SELECT id INTO v_agent_id
  FROM public.zapp_agents
  WHERE user_id = v_responsible_user_id
    AND account_id = NEW.account_id
    AND is_active = true
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert active assignment (idempotent via unique constraint)
  INSERT INTO public.zapp_conversation_assignments (
    account_id,
    zapp_conversation_id,
    agent_id,
    status,
    assigned_at
  ) VALUES (
    NEW.account_id,
    NEW.id,
    v_agent_id,
    'active'::zapp_assignment_status,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_zapp_conversation_trigger ON public.zapp_conversations;
CREATE TRIGGER auto_assign_zapp_conversation_trigger
AFTER INSERT ON public.zapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_zapp_conversation();

-- Backfill: also fire when a conversation gets linked to a client later (UPDATE client_id from null)
CREATE OR REPLACE FUNCTION public.auto_assign_zapp_conversation_on_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsible_user_id uuid;
  v_agent_id uuid;
  v_existing_count int;
BEGIN
  IF NEW.client_id IS NULL OR (OLD.client_id IS NOT NULL AND OLD.client_id = NEW.client_id) THEN
    RETURN NEW;
  END IF;

  -- Skip if there is already any assignment for this conversation
  SELECT count(*) INTO v_existing_count
  FROM public.zapp_conversation_assignments
  WHERE zapp_conversation_id = NEW.id
    AND status <> 'closed'::zapp_assignment_status;

  IF v_existing_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT responsible_user_id INTO v_responsible_user_id
  FROM public.clients
  WHERE id = NEW.client_id
  LIMIT 1;

  IF v_responsible_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_agent_id
  FROM public.zapp_agents
  WHERE user_id = v_responsible_user_id
    AND account_id = NEW.account_id
    AND is_active = true
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.zapp_conversation_assignments (
    account_id,
    zapp_conversation_id,
    agent_id,
    status,
    assigned_at
  ) VALUES (
    NEW.account_id,
    NEW.id,
    v_agent_id,
    'active'::zapp_assignment_status,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_zapp_conversation_on_link_trigger ON public.zapp_conversations;
CREATE TRIGGER auto_assign_zapp_conversation_on_link_trigger
AFTER UPDATE OF client_id ON public.zapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_zapp_conversation_on_link();