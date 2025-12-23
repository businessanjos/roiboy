-- Add max_whatsapp_connections column to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_whatsapp_connections INTEGER DEFAULT 1;

-- Update existing plans with WhatsApp connection limits
-- Starter: 1 connection
UPDATE public.subscription_plans 
SET max_whatsapp_connections = 1 
WHERE name = 'Starter';

-- Pro: 2 connections
UPDATE public.subscription_plans 
SET max_whatsapp_connections = 2 
WHERE name = 'Pro';

-- ROY: 4 connections
UPDATE public.subscription_plans 
SET max_whatsapp_connections = 4 
WHERE name = 'Plano ROY';

-- User add-on doesn't include WhatsApp connections
UPDATE public.subscription_plans 
SET max_whatsapp_connections = 0 
WHERE name = 'Usuário Adicional';

-- Create WhatsApp connection add-on
INSERT INTO public.subscription_plans (
  name,
  description,
  price,
  billing_period,
  max_whatsapp_connections,
  max_clients,
  max_users,
  max_events,
  max_products,
  max_forms,
  max_ai_analyses,
  max_storage_mb,
  plan_type,
  features,
  is_active
) VALUES (
  'Conexão WhatsApp',
  'Conexão adicional de WhatsApp para sua conta',
  200.00,
  'monthly',
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  'addon',
  '{"addon": true, "type": "whatsapp_connection"}'::jsonb,
  true
);