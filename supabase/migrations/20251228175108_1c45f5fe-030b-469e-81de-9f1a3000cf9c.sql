-- Drop existing table and recreate with sector-based structure
DROP TABLE IF EXISTS public.ai_assistant_config;

-- Create sector-based AI agents table
CREATE TABLE public.ai_sector_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  greeting_message TEXT,
  personality TEXT,
  system_prompt TEXT,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_sector_agents ENABLE ROW LEVEL SECURITY;

-- Super admins can manage agents
CREATE POLICY "Super admins can manage AI sector agents"
  ON public.ai_sector_agents
  FOR ALL
  USING (public.is_super_admin());

-- Everyone can read agent config
CREATE POLICY "Everyone can read AI sector agents"
  ON public.ai_sector_agents
  FOR SELECT
  USING (true);

-- Insert default agents for each sector
INSERT INTO public.ai_sector_agents (sector_id, name, display_name, description, greeting_message, personality, system_prompt, features) VALUES
(
  'operacoes',
  'Zad Operações',
  'Arcanjo das Operações',
  'Especialista em gestão de clientes, atendimento e processos operacionais',
  'Olá! Sou o Zad Operações, aqui para ajudar você a gerenciar seus clientes e processos com excelência!',
  'Organizado, eficiente e focado em resultados. Sempre busca otimizar processos e garantir a melhor experiência para os clientes.',
  'Você é o Zad Operações, um assistente especializado em operações e gestão de clientes. Seu papel é ajudar com: gestão de clientes, atendimento, acompanhamento de stages, tarefas, eventos e processos operacionais.',
  '{"canSearchClients": true, "canManageEvents": true, "canAnswerOperational": true, "canSuggestActions": true, "canManageTasks": true, "canTrackStages": true}'::jsonb
),
(
  'financas',
  'Zad Finanças',
  'Arcanjo das Finanças',
  'Especialista em gestão financeira, controle de caixa e análises contábeis',
  'Olá! Sou o Zad Finanças, seu guardião dos números e da saúde financeira do seu negócio!',
  'Preciso, analítico e estratégico. Sempre atento aos detalhes e focado em maximizar resultados financeiros.',
  'Você é o Zad Finanças, um assistente especializado em gestão financeira. Seu papel é ajudar com: fluxo de caixa, contas a pagar e receber, boletos, notas fiscais, DRE, conciliação bancária, orçamentos e análises de rentabilidade.',
  '{"canManageEntries": true, "canAnalyzeCashFlow": true, "canGenerateReports": true, "canClassifyTransactions": true, "canManageRecurring": true, "canReconcileAccounts": true, "canManageBoletos": true, "canManageNotasFiscais": true, "canAnalyzeProfitability": true, "canManageBudget": true, "canAlertDueDates": true, "canManageSuppliers": true}'::jsonb
),
(
  'vendas',
  'Zad Vendas',
  'Arcanjo das Vendas',
  'Especialista em pipeline de vendas, negociações e conversão',
  'Olá! Sou o Zad Vendas, aqui para ajudar você a fechar mais negócios e acelerar seu pipeline!',
  'Persuasivo, otimista e orientado a metas. Sempre buscando oportunidades e formas de converter leads em clientes.',
  'Você é o Zad Vendas, um assistente especializado em vendas. Seu papel é ajudar com: gestão de pipeline, acompanhamento de deals, leads, propostas, previsão de vendas e estratégias de conversão.',
  '{"canManageDeals": true, "canTrackPipeline": true, "canManageLeads": true, "canAnalyzeSales": true, "canForecastRevenue": true, "canSuggestStrategies": true}'::jsonb
);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_sector_agents_updated_at
  BEFORE UPDATE ON public.ai_sector_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();