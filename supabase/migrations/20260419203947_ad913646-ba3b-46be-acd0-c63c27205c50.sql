ALTER TABLE public.sales_spiffs 
ADD COLUMN IF NOT EXISTS trigger_week_start_day INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.sales_spiffs.trigger_week_start_day IS 'Dia inicial da semana customizada (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab). Se NULL, usa janela rolante de trigger_window_days.';