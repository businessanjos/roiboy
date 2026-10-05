CREATE OR REPLACE FUNCTION public.audit_unified_authors(
  p_account_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_scope text DEFAULT 'system',
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (user_id text, user_name text, user_email text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Reutiliza exatamente o conjunto enriquecido e o predicado de audit_unified_page
  -- (mesma descrição, contexto, details e normalização deleted_by -> users.id),
  -- removendo apenas o filtro por pessoa. Um autor por user_id; nome/e-mail
  -- vêm do registro mais recente (ordem determinística created_at, source, id).
  SELECT x.user_id, x.user_name, x.user_email
  FROM (
    SELECT DISTINCT ON (p.user_id) p.user_id, p.user_name, p.user_email
    FROM public.audit_unified_page(
      p_account_id, p_from, p_to, p_scope, p_action, p_entity_type,
      NULL, p_search, 0, NULL
    ) p
    WHERE p.user_id IS NOT NULL
    ORDER BY p.user_id, p.created_at DESC, p.source, p.id
  ) x
  ORDER BY x.user_name NULLS LAST, x.user_email NULLS LAST, x.user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_unified_authors(
  uuid, timestamptz, timestamptz, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_unified_authors(
  uuid, timestamptz, timestamptz, text, text, text, text
) TO authenticated;