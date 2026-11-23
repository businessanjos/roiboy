CREATE TABLE public.tv_proxy_session (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auth_user_id uuid,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'unknown',
  last_error text,
  last_login_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tv_proxy_session TO service_role;
ALTER TABLE public.tv_proxy_session ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tv_proxy_status()
RETURNS TABLE(status text, last_error text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.status, s.last_error, s.updated_at FROM public.tv_proxy_session s
  WHERE public.tv_can_manage(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.tv_proxy_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tv_proxy_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.tv_proxy_rpc_is_readonly(_fn text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(bool_and(p.provolatile IN ('s','i')), false)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = _fn;
$$;
REVOKE ALL ON FUNCTION public.tv_proxy_rpc_is_readonly(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_proxy_rpc_is_readonly(text) TO service_role;