
-- ═══════════════════════════════════════════════════════════════════════════
-- BACKOFFICE DE EVENTOS - Tabelas para gestão completa de eventos
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. PROGRAMAÇÃO DO EVENTO (agenda/cronograma)
CREATE TABLE public.event_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  location TEXT,
  speaker TEXT,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. CHECKLIST DO EVENTO
CREATE TYPE event_checklist_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

CREATE TABLE public.event_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status event_checklist_status NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES public.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.users(id),
  category TEXT, -- Ex: 'preparação', 'logística', 'marketing', 'pós-evento'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. BRINDES/PRESENTES DO EVENTO
CREATE TYPE event_gift_status AS ENUM ('planned', 'purchased', 'in_stock', 'distributed');

CREATE TABLE public.event_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_distributed INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  status event_gift_status NOT NULL DEFAULT 'planned',
  supplier TEXT,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. CUSTOS/FINANCEIRO DO EVENTO
CREATE TYPE event_cost_category AS ENUM (
  'venue', -- Local/espaço
  'catering', -- Alimentação
  'equipment', -- Equipamentos
  'marketing', -- Divulgação
  'travel', -- Viagens
  'accommodation', -- Hospedagem
  'speakers', -- Palestrantes
  'gifts', -- Brindes (link com event_gifts)
  'staff', -- Equipe
  'technology', -- Tecnologia
  'insurance', -- Seguros
  'other' -- Outros
);

CREATE TYPE event_cost_status AS ENUM ('estimated', 'approved', 'paid', 'cancelled');

CREATE TABLE public.event_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category event_cost_category NOT NULL DEFAULT 'other',
  estimated_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_value NUMERIC(12,2),
  status event_cost_status NOT NULL DEFAULT 'estimated',
  supplier TEXT,
  invoice_number TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. NOTAS/OBSERVAÇÕES DO EVENTO (experiência do evento)
CREATE TABLE public.event_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general', -- 'general', 'experience', 'feedback', 'improvement'
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ADICIONAR CAMPOS EXTRAS NA TABELA DE EVENTOS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_attendees INTEGER,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'; -- 'draft', 'planned', 'confirmed', 'in_progress', 'completed', 'cancelled'

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.event_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;

-- event_schedule policies
CREATE POLICY "Users can view schedule in their account" ON public.event_schedule
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert schedule in their account" ON public.event_schedule
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update schedule in their account" ON public.event_schedule
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete schedule in their account" ON public.event_schedule
  FOR DELETE USING (account_id = get_user_account_id());

-- event_checklist policies
CREATE POLICY "Users can view checklist in their account" ON public.event_checklist
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert checklist in their account" ON public.event_checklist
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update checklist in their account" ON public.event_checklist
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete checklist in their account" ON public.event_checklist
  FOR DELETE USING (account_id = get_user_account_id());

-- event_gifts policies
CREATE POLICY "Users can view gifts in their account" ON public.event_gifts
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert gifts in their account" ON public.event_gifts
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update gifts in their account" ON public.event_gifts
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete gifts in their account" ON public.event_gifts
  FOR DELETE USING (account_id = get_user_account_id());

-- event_costs policies
CREATE POLICY "Users can view costs in their account" ON public.event_costs
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert costs in their account" ON public.event_costs
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update costs in their account" ON public.event_costs
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete costs in their account" ON public.event_costs
  FOR DELETE USING (account_id = get_user_account_id());

-- event_notes policies
CREATE POLICY "Users can view notes in their account" ON public.event_notes
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert notes in their account" ON public.event_notes
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update notes in their account" ON public.event_notes
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete notes in their account" ON public.event_notes
  FOR DELETE USING (account_id = get_user_account_id());

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS para updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_event_schedule_updated_at
  BEFORE UPDATE ON public.event_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_checklist_updated_at
  BEFORE UPDATE ON public.event_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_gifts_updated_at
  BEFORE UPDATE ON public.event_gifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_costs_updated_at
  BEFORE UPDATE ON public.event_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_notes_updated_at
  BEFORE UPDATE ON public.event_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- ÍNDICES para performance
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_event_schedule_event ON public.event_schedule(event_id);
CREATE INDEX idx_event_checklist_event ON public.event_checklist(event_id);
CREATE INDEX idx_event_checklist_status ON public.event_checklist(status);
CREATE INDEX idx_event_gifts_event ON public.event_gifts(event_id);
CREATE INDEX idx_event_costs_event ON public.event_costs(event_id);
CREATE INDEX idx_event_costs_category ON public.event_costs(category);
CREATE INDEX idx_event_notes_event ON public.event_notes(event_id);
