-- Pools de prêmios reutilizáveis para roletas de SPIFFs
CREATE TABLE public.roulette_prize_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prêmios individuais dentro de cada pool
CREATE TABLE public.roulette_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.roulette_prize_pools(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  cash_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 1),
  color TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_roulette_prizes_pool ON public.roulette_prizes(pool_id);
CREATE INDEX idx_roulette_prize_pools_account ON public.roulette_prize_pools(account_id);

-- Vincular SPIFF a um pool
ALTER TABLE public.sales_spiffs ADD COLUMN roulette_pool_id UUID REFERENCES public.roulette_prize_pools(id) ON DELETE SET NULL;

-- Registrar qual prêmio foi sorteado em cada giro
ALTER TABLE public.spiff_spins ADD COLUMN prize_id UUID REFERENCES public.roulette_prizes(id) ON DELETE SET NULL;
ALTER TABLE public.spiff_spins ADD COLUMN prize_label TEXT;

-- RLS
ALTER TABLE public.roulette_prize_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roulette pools in their account"
  ON public.roulette_prize_pools FOR SELECT TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "Users can insert roulette pools in their account"
  ON public.roulette_prize_pools FOR INSERT TO authenticated
  WITH CHECK (account_id = get_my_account_id());

CREATE POLICY "Users can update roulette pools in their account"
  ON public.roulette_prize_pools FOR UPDATE TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "Users can delete roulette pools in their account"
  ON public.roulette_prize_pools FOR DELETE TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "Users can view roulette prizes in their account"
  ON public.roulette_prizes FOR SELECT TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "Users can insert roulette prizes in their account"
  ON public.roulette_prizes FOR INSERT TO authenticated
  WITH CHECK (account_id = get_my_account_id());

CREATE POLICY "Users can update roulette prizes in their account"
  ON public.roulette_prizes FOR UPDATE TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "Users can delete roulette prizes in their account"
  ON public.roulette_prizes FOR DELETE TO authenticated
  USING (account_id = get_my_account_id());

-- Trigger updated_at
CREATE TRIGGER update_roulette_prize_pools_updated_at
  BEFORE UPDATE ON public.roulette_prize_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roulette_prizes_updated_at
  BEFORE UPDATE ON public.roulette_prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();