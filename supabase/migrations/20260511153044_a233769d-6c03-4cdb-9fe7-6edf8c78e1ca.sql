ALTER TABLE public.digital_contracts
  ADD COLUMN IF NOT EXISTS signed_file_url text,
  ADD COLUMN IF NOT EXISTS zapsign_signers jsonb;