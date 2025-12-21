
-- Add responsible user to clients table
ALTER TABLE public.clients 
ADD COLUMN responsible_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_clients_responsible_user ON public.clients(responsible_user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.clients.responsible_user_id IS 'User responsible for managing this client';
