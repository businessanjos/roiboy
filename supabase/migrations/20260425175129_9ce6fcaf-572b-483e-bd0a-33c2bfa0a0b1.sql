-- Default oficial para novos usuários
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'member'::public.user_role;

-- Trigger de validação (CHECK não funciona em ENUMs antigos com cargos legados)
CREATE OR REPLACE FUNCTION public.validate_user_access_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text NOT IN ('admin', 'super_admin', 'gestor', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Perfil de acesso inválido: "%". Valores aceitos: admin, gestor, member, viewer.', NEW.role::text
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_access_profile ON public.users;
CREATE TRIGGER trg_validate_user_access_profile
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_access_profile();