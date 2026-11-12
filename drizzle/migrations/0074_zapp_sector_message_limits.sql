CREATE TABLE public.zapp_sector_message_limits (
  account_id uuid NOT NULL,
  sector_id text NOT NULL,
  hourly_limit integer NOT NULL DEFAULT 80,
  today_limit integer,
  today_date date,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, sector_id)
);
GRANT SELECT, INSERT, UPDATE ON public.zapp_sector_message_limits TO authenticated;
GRANT ALL ON public.zapp_sector_message_limits TO service_role;
ALTER TABLE public.zapp_sector_message_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read sector msg limits" ON public.zapp_sector_message_limits
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Sector admins insert msg limits" ON public.zapp_sector_message_limits
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id()
    AND public.zapp_sector_role(auth.uid(), sector_id) IN ('admin','manager'));
CREATE POLICY "Sector admins update msg limits" ON public.zapp_sector_message_limits
  FOR UPDATE TO authenticated
  USING (account_id = public.get_user_account_id() AND public.zapp_sector_role(auth.uid(), sector_id) IN ('admin','manager'))
  WITH CHECK (account_id = public.get_user_account_id() AND public.zapp_sector_role(auth.uid(), sector_id) IN ('admin','manager'));

CREATE TABLE public.zapp_sector_message_limit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sector_id text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  old_hourly integer, new_hourly integer,
  old_today integer, new_today integer,
  today_date date,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zapp_sector_message_limit_history TO authenticated;
GRANT ALL ON public.zapp_sector_message_limit_history TO service_role;
ALTER TABLE public.zapp_sector_message_limit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sector admins read msg limit history" ON public.zapp_sector_message_limit_history
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id()
    AND public.zapp_sector_role(auth.uid(), sector_id) IN ('admin','manager'));

CREATE OR REPLACE FUNCTION public.log_zapp_sector_message_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.hourly_limit IS NOT DISTINCT FROM NEW.hourly_limit
     AND OLD.today_limit IS NOT DISTINCT FROM NEW.today_limit
     AND OLD.today_date IS NOT DISTINCT FROM NEW.today_date THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.zapp_sector_message_limit_history
    (account_id, sector_id, changed_by, changed_by_name, old_hourly, new_hourly, old_today, new_today, today_date)
  VALUES (NEW.account_id, NEW.sector_id, auth.uid(),
    (SELECT name FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1),
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.hourly_limit END, NEW.hourly_limit,
    CASE WHEN TG_OP = 'UPDATE' AND OLD.today_date = NEW.today_date THEN OLD.today_limit END, NEW.today_limit,
    NEW.today_date);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_zapp_sector_message_limit
  AFTER INSERT OR UPDATE ON public.zapp_sector_message_limits
  FOR EACH ROW EXECUTE FUNCTION public.log_zapp_sector_message_limit();

CREATE OR REPLACE FUNCTION public.zapp_sector_message_usage_today(p_sector_id text)
RETURNS TABLE(user_id uuid, user_name text, last_hour bigint, today bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name,
    count(*) FILTER (WHERE m.created_at >= now() - interval '1 hour'),
    count(*)
  FROM zapp_messages m
  JOIN users u ON u.id = m.sender_user_id
  WHERE public.zapp_sector_role(auth.uid(), p_sector_id) IN ('admin','manager')
    AND m.account_id = public.get_user_account_id()
    AND m.direction = 'outbound'
    AND m.created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
    AND u.id IN (SELECT usa.user_id FROM user_sector_access usa WHERE usa.sector_id = p_sector_id AND usa.is_active = true)
  GROUP BY u.id, u.name
  ORDER BY 3 DESC, 4 DESC;
$$;
REVOKE ALL ON FUNCTION public.zapp_sector_message_usage_today(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_sector_message_usage_today(text) TO authenticated;

REVOKE ALL ON FUNCTION public.zapp_message_usage_today() FROM authenticated;
COMMENT ON COLUMN public.zapp_account_settings.msg_hourly_limit IS 'DEPRECATED: replaced by zapp_sector_message_limits';
COMMENT ON COLUMN public.zapp_account_settings.msg_today_limit IS 'DEPRECATED: replaced by zapp_sector_message_limits';
COMMENT ON COLUMN public.zapp_account_settings.msg_today_date IS 'DEPRECATED: replaced by zapp_sector_message_limits';