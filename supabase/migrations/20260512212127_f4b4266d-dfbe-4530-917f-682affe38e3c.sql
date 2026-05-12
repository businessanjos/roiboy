
-- Permitir múltiplos CNPJs Omie por conta
ALTER TABLE public.omie_settings DROP CONSTRAINT IF EXISTS omie_settings_account_id_key;

ALTER TABLE public.omie_settings
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Não permitir 2 CNPJs iguais na mesma conta (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS omie_settings_account_cnpj_uq
  ON public.omie_settings (account_id, cnpj)
  WHERE cnpj IS NOT NULL;

-- Apenas 1 default por conta
CREATE UNIQUE INDEX IF NOT EXISTS omie_settings_account_default_uq
  ON public.omie_settings (account_id)
  WHERE is_default = true;

-- Marcar a configuração existente como default (única hoje)
UPDATE public.omie_settings s
SET is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.omie_settings d
  WHERE d.account_id = s.account_id AND d.is_default = true
);

-- Função para garantir que ao marcar um como default, os outros viram false
CREATE OR REPLACE FUNCTION public.omie_settings_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.omie_settings
       SET is_default = false
     WHERE account_id = NEW.account_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_omie_settings_single_default ON public.omie_settings;
CREATE TRIGGER trg_omie_settings_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.omie_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.omie_settings_enforce_single_default();
