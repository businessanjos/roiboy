-- Create zapsign_documents table to track ZapSign documents
CREATE TABLE public.zapsign_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  
  -- ZapSign document info
  zapsign_doc_token TEXT NOT NULL,
  zapsign_template_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- URLs
  original_file_url TEXT,
  signed_file_url TEXT,
  
  -- Signers info (stored as JSON for flexibility)
  signers JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT zapsign_documents_account_id_zapsign_doc_token_key UNIQUE (account_id, zapsign_doc_token)
);

-- Create index for faster queries
CREATE INDEX idx_zapsign_documents_account ON public.zapsign_documents(account_id);
CREATE INDEX idx_zapsign_documents_client ON public.zapsign_documents(client_id);
CREATE INDEX idx_zapsign_documents_contract ON public.zapsign_documents(contract_id);
CREATE INDEX idx_zapsign_documents_status ON public.zapsign_documents(status);

-- Enable RLS
ALTER TABLE public.zapsign_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own account zapsign documents"
ON public.zapsign_documents FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert zapsign documents for own account"
ON public.zapsign_documents FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update own account zapsign documents"
ON public.zapsign_documents FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete own account zapsign documents"
ON public.zapsign_documents FOR DELETE
USING (account_id = get_user_account_id());

-- Add trigger for updated_at
CREATE TRIGGER update_zapsign_documents_updated_at
BEFORE UPDATE ON public.zapsign_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();