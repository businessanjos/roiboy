ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS contact_channel text;
COMMENT ON COLUMN public.internal_tasks.contact_channel IS 'Ferramenta usada no contato (3c_plus, whatsapp, telefone)';
CREATE INDEX IF NOT EXISTS idx_internal_tasks_contact_channel ON public.internal_tasks (contact_channel) WHERE contact_channel IS NOT NULL;