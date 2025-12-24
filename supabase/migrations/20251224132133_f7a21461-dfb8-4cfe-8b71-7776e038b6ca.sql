-- Tabela para itens de checklist de cada etapa
CREATE TABLE public.stage_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.client_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para rastrear progresso do checklist por cliente
CREATE TABLE public.client_stage_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.stage_checklist_items(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, checklist_item_id)
);

-- Enable RLS
ALTER TABLE public.stage_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_stage_checklist ENABLE ROW LEVEL SECURITY;

-- Policies for stage_checklist_items
CREATE POLICY "Users can view checklist items in their account"
  ON public.stage_checklist_items FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert checklist items in their account"
  ON public.stage_checklist_items FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update checklist items in their account"
  ON public.stage_checklist_items FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete checklist items in their account"
  ON public.stage_checklist_items FOR DELETE
  USING (account_id = get_user_account_id());

-- Policies for client_stage_checklist
CREATE POLICY "Users can view client checklist in their account"
  ON public.client_stage_checklist FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert client checklist in their account"
  ON public.client_stage_checklist FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update client checklist in their account"
  ON public.client_stage_checklist FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete client checklist in their account"
  ON public.client_stage_checklist FOR DELETE
  USING (account_id = get_user_account_id());

-- Indexes
CREATE INDEX idx_stage_checklist_items_stage ON public.stage_checklist_items(stage_id);
CREATE INDEX idx_client_stage_checklist_client ON public.client_stage_checklist(client_id);
CREATE INDEX idx_client_stage_checklist_item ON public.client_stage_checklist(checklist_item_id);