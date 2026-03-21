
-- Create deal_loss_reasons table (main categories)
CREATE TABLE public.deal_loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create deal_loss_sub_reasons table (subcategories)
CREATE TABLE public.deal_loss_sub_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  loss_reason_id uuid NOT NULL REFERENCES public.deal_loss_reasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add structured fields to deals table
ALTER TABLE public.deals 
  ADD COLUMN loss_reason_id uuid REFERENCES public.deal_loss_reasons(id),
  ADD COLUMN loss_sub_reason_id uuid REFERENCES public.deal_loss_sub_reasons(id),
  ADD COLUMN loss_notes text;

-- Enable RLS
ALTER TABLE public.deal_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_loss_sub_reasons ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_loss_reasons
CREATE POLICY "Users can view their account loss reasons"
  ON public.deal_loss_reasons FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage their account loss reasons"
  ON public.deal_loss_reasons FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

-- RLS policies for deal_loss_sub_reasons
CREATE POLICY "Users can view their account loss sub reasons"
  ON public.deal_loss_sub_reasons FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage their account loss sub reasons"
  ON public.deal_loss_sub_reasons FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

-- Create function to seed default loss reasons for new accounts
CREATE OR REPLACE FUNCTION public.create_default_loss_reasons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reason_id uuid;
BEGIN
  -- Preço / Sem orçamento
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Preço / Sem orçamento', 1) RETURNING id INTO v_reason_id;
  INSERT INTO public.deal_loss_sub_reasons (account_id, loss_reason_id, name, display_order) VALUES
    (NEW.id, v_reason_id, 'Achou caro', 1),
    (NEW.id, v_reason_id, 'Sem orçamento no momento', 2),
    (NEW.id, v_reason_id, 'Encontrou mais barato', 3);

  -- Concorrência
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Concorrência', 2) RETURNING id INTO v_reason_id;
  INSERT INTO public.deal_loss_sub_reasons (account_id, loss_reason_id, name, display_order) VALUES
    (NEW.id, v_reason_id, 'Optou por concorrente direto', 1),
    (NEW.id, v_reason_id, 'Optou por solução alternativa', 2);

  -- Timing / Não é o momento
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Timing / Não é o momento', 3) RETURNING id INTO v_reason_id;
  INSERT INTO public.deal_loss_sub_reasons (account_id, loss_reason_id, name, display_order) VALUES
    (NEW.id, v_reason_id, 'Vai reavaliar no futuro', 1),
    (NEW.id, v_reason_id, 'Prioridades mudaram', 2),
    (NEW.id, v_reason_id, 'Momento pessoal/profissional inadequado', 3);

  -- Sem resposta / Ghosting
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Sem resposta / Ghosting', 4) RETURNING id INTO v_reason_id;
  INSERT INTO public.deal_loss_sub_reasons (account_id, loss_reason_id, name, display_order) VALUES
    (NEW.id, v_reason_id, 'Sumiu após proposta', 1),
    (NEW.id, v_reason_id, 'Nunca respondeu', 2),
    (NEW.id, v_reason_id, 'Parou de responder no follow-up', 3);

  -- Produto / Serviço não adequado
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Produto / Serviço não adequado', 5) RETURNING id INTO v_reason_id;
  INSERT INTO public.deal_loss_sub_reasons (account_id, loss_reason_id, name, display_order) VALUES
    (NEW.id, v_reason_id, 'Não atende a necessidade', 1),
    (NEW.id, v_reason_id, 'Expectativa diferente', 2);

  -- Outro
  INSERT INTO public.deal_loss_reasons (account_id, name, display_order) 
  VALUES (NEW.id, 'Outro', 6);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_loss_reasons
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_loss_reasons();
