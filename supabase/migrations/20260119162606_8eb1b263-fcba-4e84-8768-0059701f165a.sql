-- Adicionar coluna para arquivo de convite na tabela events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS invitation_file_url TEXT;

COMMENT ON COLUMN public.events.invitation_file_url IS 
  'URL do arquivo (imagem ou PDF) a ser enviado junto com o convite do evento';