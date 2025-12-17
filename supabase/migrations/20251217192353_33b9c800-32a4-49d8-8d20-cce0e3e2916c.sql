-- Create client_contracts table
CREATE TABLE public.client_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_option TEXT,
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view contracts in their account"
ON public.client_contracts FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert contracts in their account"
ON public.client_contracts FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update contracts in their account"
ON public.client_contracts FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete contracts in their account"
ON public.client_contracts FOR DELETE
USING (account_id = get_user_account_id());

-- Create trigger for updated_at
CREATE TRIGGER update_client_contracts_updated_at
BEFORE UPDATE ON public.client_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for contract files
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- Storage policies for contracts bucket
CREATE POLICY "Users can view their account contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.accounts WHERE id = get_user_account_id()
));

CREATE POLICY "Users can upload contracts to their account"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.accounts WHERE id = get_user_account_id()
));

CREATE POLICY "Users can delete their account contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.accounts WHERE id = get_user_account_id()
));