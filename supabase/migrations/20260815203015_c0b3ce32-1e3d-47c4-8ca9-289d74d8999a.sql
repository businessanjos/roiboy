-- 1) Seed default company from account data
INSERT INTO public.companies (
  account_id, legal_name, trade_name, document, email, phone,
  address_zip, address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, is_default, is_active
)
SELECT a.id, a.name, a.name, COALESCE(a.document, ''), a.email, a.phone,
       a.zip_code, a.street, a.street_number, a.complement,
       a.neighborhood, a.city, a.state, true, true
FROM public.accounts a
WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.account_id = a.id);

-- 2) company_id columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.client_contracts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.contratadas ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3) Backfill to default company of the account
UPDATE public.products p SET company_id = c.id
FROM public.companies c WHERE c.account_id = p.account_id AND c.is_default AND p.company_id IS NULL;

UPDATE public.deals d SET company_id = c.id
FROM public.companies c WHERE c.account_id = d.account_id AND c.is_default AND d.company_id IS NULL;

UPDATE public.client_contracts cc SET company_id = c.id
FROM public.companies c WHERE c.account_id = cc.account_id AND c.is_default AND cc.company_id IS NULL;

UPDATE public.contratadas ct SET company_id = c.id
FROM public.companies c WHERE c.account_id = ct.account_id AND c.is_default AND ct.company_id IS NULL;

UPDATE public.invoices i SET company_id = c.id
FROM public.companies c WHERE c.account_id = i.account_id AND c.is_default AND i.company_id IS NULL;

UPDATE public.financial_entries fe SET company_id = c.id
FROM public.companies c WHERE c.account_id = fe.account_id AND c.is_default AND fe.company_id IS NULL;

UPDATE public.payers p SET company_id = c.id
FROM public.companies c WHERE c.account_id = p.account_id AND c.is_default AND p.company_id IS NULL;

-- 4) Contracts inherit company from product (fallback: default company)
CREATE OR REPLACE FUNCTION public.tg_set_company_from_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.company_id INTO NEW.company_id FROM public.products p WHERE p.id = NEW.product_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    SELECT c.id INTO NEW.company_id
    FROM public.companies c
    WHERE c.account_id = NEW.account_id AND c.is_default AND c.is_active
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_contracts_set_company ON public.client_contracts;
CREATE TRIGGER trg_client_contracts_set_company
BEFORE INSERT OR UPDATE OF product_id ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_from_product();

-- Deals: default company only (product lives in custom fields)
CREATE OR REPLACE FUNCTION public.tg_set_default_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT c.id INTO NEW.company_id
    FROM public.companies c
    WHERE c.account_id = NEW.account_id AND c.is_default AND c.is_active
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_company ON public.deals;
CREATE TRIGGER trg_deals_set_company
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_set_default_company();

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_products_account_company ON public.products(account_id, company_id);
CREATE INDEX IF NOT EXISTS idx_deals_account_company ON public.deals(account_id, company_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_account_company ON public.client_contracts(account_id, company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_account_company ON public.invoices(account_id, company_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_account_company ON public.financial_entries(account_id, company_id);
CREATE INDEX IF NOT EXISTS idx_payers_account_company ON public.payers(account_id, company_id);