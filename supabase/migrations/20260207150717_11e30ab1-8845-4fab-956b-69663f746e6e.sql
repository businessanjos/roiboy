-- Tabela para configuração de limites de consumo de IA
CREATE TABLE public.ai_usage_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  max_analyses_per_day INTEGER DEFAULT 25,
  max_tokens_per_day INTEGER DEFAULT 150000,
  max_cost_per_day NUMERIC(10,4) DEFAULT 1.00,
  alert_email TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  last_alert_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

-- Tabela para log de alertas enviados
CREATE TABLE public.ai_usage_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'analyses', 'tokens', 'cost'
  threshold_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL,
  alert_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_sent_to TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_alerts ENABLE ROW LEVEL SECURITY;

-- Policies para admins
CREATE POLICY "Admins can manage usage limits" ON public.ai_usage_limits
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.account_id = ai_usage_limits.account_id 
    AND u.role = 'admin'
  )
);

CREATE POLICY "Admins can view usage alerts" ON public.ai_usage_alerts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.account_id = ai_usage_alerts.account_id 
    AND u.role = 'admin'
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_ai_usage_limits_updated_at
BEFORE UPDATE ON public.ai_usage_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão para a conta principal (roycxadm)
INSERT INTO public.ai_usage_limits (account_id, alert_email, max_analyses_per_day, max_tokens_per_day, max_cost_per_day)
SELECT DISTINCT u.account_id, 'roycxadm@gmail.com', 25, 150000, 1.00
FROM public.users u 
WHERE u.email = 'roycxadm@gmail.com' 
AND u.account_id IS NOT NULL
ON CONFLICT (account_id) DO NOTHING;