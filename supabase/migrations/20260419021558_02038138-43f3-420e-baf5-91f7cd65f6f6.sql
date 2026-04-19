ALTER TABLE public.sales_spiffs
ADD COLUMN IF NOT EXISTS trigger_sales_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trigger_window_days integer NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS custom_prize_description text;