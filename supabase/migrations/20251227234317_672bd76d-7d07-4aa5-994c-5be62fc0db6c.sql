-- Adicionar campos de inscrição estadual e municipal na tabela suppliers
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;