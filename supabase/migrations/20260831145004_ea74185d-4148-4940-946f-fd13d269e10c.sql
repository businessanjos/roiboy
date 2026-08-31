DO $do$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'zapp_productivity_metrics' AND p.pronargs = 5;

  IF def IS NULL THEN
    RAISE EXCEPTION 'função base não encontrada';
  END IF;

  def := replace(def, '_include_groups boolean DEFAULT false)', '_include_groups boolean DEFAULT false, _agent_user_id uuid DEFAULT NULL::uuid)');

  def := replace(def,
'  WITH convs AS (
    SELECT c.id, c.client_id, c.is_group, c.contact_name, c.phone_e164, c.created_at',
'  WITH convs_raw AS (
    SELECT c.id, c.client_id, c.is_group, c.contact_name, c.phone_e164, c.created_at');

  def := replace(def,
'      AND (_include_groups OR coalesce(c.is_group, false) = false)
  ),',
'      AND (_include_groups OR coalesce(c.is_group, false) = false)
  ),
  convs AS (
    SELECT cr.* FROM convs_raw cr
    WHERE _agent_user_id IS NULL OR EXISTS (
      SELECT 1 FROM public.zapp_messages m2
      WHERE m2.zapp_conversation_id = cr.id
        AND m2.account_id = _account
        AND m2.sender_user_id = _agent_user_id
        AND coalesce(m2.is_deleted, false) = false
        AND m2.sent_at >= _from AND m2.sent_at < _to
    )
  ),');

  def := replace(def,
'    WHERE m.account_id = _account
      AND coalesce(m.is_deleted, false) = false
    ORDER BY coalesce(m.external_message_id, m.id::text), m.sent_at ASC, m.id ASC',
'    WHERE m.account_id = _account
      AND coalesce(m.is_deleted, false) = false
      AND (_agent_user_id IS NULL OR m.direction = ''inbound'' OR m.sender_user_id = _agent_user_id)
    ORDER BY coalesce(m.external_message_id, m.id::text), m.sent_at ASC, m.id ASC');

  def := replace(def, '''include_groups'', _include_groups,', '''include_groups'', _include_groups,
    ''agent_user_id'', _agent_user_id,');

  IF position('_agent_user_id uuid DEFAULT' in def) = 0 OR position('convs_raw' in def) = 0
     OR position('m.direction = ''inbound'' OR m.sender_user_id = _agent_user_id' in def) = 0 THEN
    RAISE EXCEPTION 'substituições não aplicadas';
  END IF;

  EXECUTE def;
END
$do$;

DROP FUNCTION IF EXISTS public.zapp_productivity_metrics(text, timestamp with time zone, timestamp with time zone, uuid, boolean);