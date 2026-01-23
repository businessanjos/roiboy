-- Tabela para organizar os painéis/dashboards (funcionalidades extras)
CREATE TABLE public.insights_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  folder TEXT DEFAULT 'Meus Painéis',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para os gráficos individuais (Visuais)
CREATE TABLE public.insights_visuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES public.insights_dashboards(id) ON DELETE CASCADE,
  title TEXT,
  chart_type TEXT, -- 'bar', 'line', 'pie', 'number'
  config JSONB DEFAULT '{}', -- Configurações do visual (métricas, cores, fórmulas)
  layout JSONB DEFAULT '{}', -- Posição x, y, w, h no grid
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.insights_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_visuals ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver dashboards da sua conta
CREATE POLICY "Users can view dashboards from their account"
ON public.insights_dashboards FOR SELECT
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem criar dashboards na sua conta
CREATE POLICY "Users can create dashboards for their account"
ON public.insights_dashboards FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT u.account_id FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem atualizar dashboards da sua conta
CREATE POLICY "Users can update dashboards from their account"
ON public.insights_dashboards FOR UPDATE
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem deletar dashboards da sua conta
CREATE POLICY "Users can delete dashboards from their account"
ON public.insights_dashboards FOR DELETE
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem ver visuais de dashboards da sua conta
CREATE POLICY "Users can view visuals from their account dashboards"
ON public.insights_visuals FOR SELECT
USING (
  dashboard_id IN (
    SELECT d.id FROM public.insights_dashboards d
    JOIN public.users u ON d.account_id = u.account_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem criar visuais em dashboards da sua conta
CREATE POLICY "Users can create visuals in their account dashboards"
ON public.insights_visuals FOR INSERT
WITH CHECK (
  dashboard_id IN (
    SELECT d.id FROM public.insights_dashboards d
    JOIN public.users u ON d.account_id = u.account_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem atualizar visuais de dashboards da sua conta
CREATE POLICY "Users can update visuals from their account dashboards"
ON public.insights_visuals FOR UPDATE
USING (
  dashboard_id IN (
    SELECT d.id FROM public.insights_dashboards d
    JOIN public.users u ON d.account_id = u.account_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Política: usuários podem deletar visuais de dashboards da sua conta
CREATE POLICY "Users can delete visuals from their account dashboards"
ON public.insights_visuals FOR DELETE
USING (
  dashboard_id IN (
    SELECT d.id FROM public.insights_dashboards d
    JOIN public.users u ON d.account_id = u.account_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Índices para performance
CREATE INDEX idx_insights_dashboards_account_id ON public.insights_dashboards(account_id);
CREATE INDEX idx_insights_dashboards_user_id ON public.insights_dashboards(user_id);
CREATE INDEX idx_insights_visuals_dashboard_id ON public.insights_visuals(dashboard_id);