-- Create financial_categories table (categorias customizáveis)
CREATE TABLE public.financial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'both')),
  color text NOT NULL DEFAULT '#6366f1',
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create bank_accounts table (contas bancárias)
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text NOT NULL,
  bank_code text,
  agency text,
  agency_digit text,
  account_number text,
  account_digit text,
  account_type text NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'investment', 'cash')),
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  is_active boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT '#6366f1',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create financial_entries table (contas a pagar/receber)
CREATE TABLE public.financial_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'payable' CHECK (entry_type IN ('payable', 'receivable')),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'partially_paid')),
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  -- Recurrence fields
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_type text CHECK (recurrence_type IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  recurrence_end_date date,
  parent_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  -- Integration fields
  omie_id text,
  omie_sync_at timestamp with time zone,
  -- Conciliation fields
  is_conciliated boolean NOT NULL DEFAULT false,
  conciliated_at timestamp with time zone,
  conciliated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Extra fields
  document_number text,
  notes text,
  attachment_url text,
  attachment_name text,
  currency text NOT NULL DEFAULT 'BRL',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_financial_categories_account ON public.financial_categories(account_id);
CREATE INDEX idx_bank_accounts_account ON public.bank_accounts(account_id);
CREATE INDEX idx_financial_entries_account ON public.financial_entries(account_id);
CREATE INDEX idx_financial_entries_due_date ON public.financial_entries(due_date);
CREATE INDEX idx_financial_entries_status ON public.financial_entries(status);
CREATE INDEX idx_financial_entries_type ON public.financial_entries(entry_type);
CREATE INDEX idx_financial_entries_client ON public.financial_entries(client_id);
CREATE INDEX idx_financial_entries_bank ON public.financial_entries(bank_account_id);

-- Enable RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for financial_categories
CREATE POLICY "Users can view categories in their account" ON public.financial_categories
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert categories in their account" ON public.financial_categories
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update categories in their account" ON public.financial_categories
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete categories in their account" ON public.financial_categories
  FOR DELETE USING (account_id = get_user_account_id());

-- RLS policies for bank_accounts
CREATE POLICY "Users can view bank_accounts in their account" ON public.bank_accounts
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert bank_accounts in their account" ON public.bank_accounts
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update bank_accounts in their account" ON public.bank_accounts
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete bank_accounts in their account" ON public.bank_accounts
  FOR DELETE USING (account_id = get_user_account_id());

-- RLS policies for financial_entries
CREATE POLICY "Users can view entries in their account" ON public.financial_entries
  FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert entries in their account" ON public.financial_entries
  FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update entries in their account" ON public.financial_entries
  FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete entries in their account" ON public.financial_entries
  FOR DELETE USING (account_id = get_user_account_id());

-- Trigger to update bank balance when entry is paid
CREATE OR REPLACE FUNCTION public.update_bank_balance_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'paid' and has bank_account_id
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.bank_account_id IS NOT NULL THEN
    IF NEW.entry_type = 'receivable' THEN
      UPDATE public.bank_accounts SET current_balance = current_balance + NEW.amount, updated_at = now()
      WHERE id = NEW.bank_account_id;
    ELSE
      UPDATE public.bank_accounts SET current_balance = current_balance - NEW.amount, updated_at = now()
      WHERE id = NEW.bank_account_id;
    END IF;
  END IF;
  
  -- If status changed from 'paid' to something else (reversal)
  IF OLD.status = 'paid' AND NEW.status != 'paid' AND OLD.bank_account_id IS NOT NULL THEN
    IF OLD.entry_type = 'receivable' THEN
      UPDATE public.bank_accounts SET current_balance = current_balance - OLD.amount, updated_at = now()
      WHERE id = OLD.bank_account_id;
    ELSE
      UPDATE public.bank_accounts SET current_balance = current_balance + OLD.amount, updated_at = now()
      WHERE id = OLD.bank_account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_bank_balance
  AFTER UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_balance_on_entry();

-- Trigger to update updated_at
CREATE TRIGGER update_financial_categories_updated_at
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();