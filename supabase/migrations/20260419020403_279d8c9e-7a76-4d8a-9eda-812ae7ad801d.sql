ALTER TABLE public.sales_spiffs
ADD COLUMN IF NOT EXISTS prize_type text NOT NULL DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS trigger_per_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS roulette_min_prize numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS roulette_max_prize numeric DEFAULT 0;

COMMENT ON COLUMN public.sales_spiffs.prize_type IS 'Tipo do prêmio: fixed (valor fixo por meta) ou roulette (giro de roleta a cada valor captado)';
COMMENT ON COLUMN public.sales_spiffs.trigger_per_value IS 'Valor em R$ de entrada captada que dá direito a 1 giro de roleta';
COMMENT ON COLUMN public.sales_spiffs.roulette_min_prize IS 'Prêmio mínimo da roleta em R$';
COMMENT ON COLUMN public.sales_spiffs.roulette_max_prize IS 'Prêmio máximo da roleta em R$';