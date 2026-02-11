
ALTER TABLE public.events ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX idx_events_client_id ON public.events(client_id);
