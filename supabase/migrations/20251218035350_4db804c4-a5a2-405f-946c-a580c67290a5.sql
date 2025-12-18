-- Add AI configuration fields to account_settings
ALTER TABLE public.account_settings
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'google/gemini-2.5-flash',
ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT DEFAULT 'Você é um analisador de mensagens de WhatsApp especializado em detectar percepção de ROI, riscos de churn e momentos de vida importantes dos clientes.',
ADD COLUMN IF NOT EXISTS ai_roi_prompt TEXT DEFAULT 'Identifique menções a ganhos tangíveis (receita, economia, tempo) ou intangíveis (confiança, clareza, tranquilidade) que o cliente obteve.',
ADD COLUMN IF NOT EXISTS ai_risk_prompt TEXT DEFAULT 'Detecte sinais de frustração, insatisfação, comparação com concorrentes, hesitação em continuar, ou mudanças de tom negativas.',
ADD COLUMN IF NOT EXISTS ai_life_events_prompt TEXT DEFAULT 'Identifique menções a eventos de vida significativos como aniversários, casamentos, gravidez, mudança de emprego, viagens importantes.',
ADD COLUMN IF NOT EXISTS ai_analysis_frequency TEXT DEFAULT 'realtime',
ADD COLUMN IF NOT EXISTS ai_min_message_length INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS ai_confidence_threshold NUMERIC DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS ai_auto_analysis_enabled BOOLEAN DEFAULT true;