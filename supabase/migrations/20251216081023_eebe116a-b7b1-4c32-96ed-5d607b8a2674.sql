-- Create event_type enum
CREATE TYPE event_type AS ENUM ('live', 'material');

-- Create delivery_status enum
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'missed');

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type NOT NULL DEFAULT 'live',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  meeting_url TEXT,
  material_url TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_products junction table
CREATE TABLE public.event_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, product_id)
);

-- Create client_event_deliveries table
CREATE TABLE public.client_event_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status delivery_status NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_method TEXT, -- 'automatic' or 'manual'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, event_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_event_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies for events
CREATE POLICY "Users can view events in their account" ON public.events
  FOR SELECT USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert events in their account" ON public.events
  FOR INSERT WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update events in their account" ON public.events
  FOR UPDATE USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete events in their account" ON public.events
  FOR DELETE USING (account_id = get_user_account_id());

-- RLS policies for event_products
CREATE POLICY "Users can view event_products in their account" ON public.event_products
  FOR SELECT USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert event_products in their account" ON public.event_products
  FOR INSERT WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete event_products in their account" ON public.event_products
  FOR DELETE USING (account_id = get_user_account_id());

-- RLS policies for client_event_deliveries
CREATE POLICY "Users can view deliveries in their account" ON public.client_event_deliveries
  FOR SELECT USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert deliveries in their account" ON public.client_event_deliveries
  FOR INSERT WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update deliveries in their account" ON public.client_event_deliveries
  FOR UPDATE USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete deliveries in their account" ON public.client_event_deliveries
  FOR DELETE USING (account_id = get_user_account_id());

-- Create triggers for updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_event_deliveries_updated_at
  BEFORE UPDATE ON public.client_event_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_events_account_id ON public.events(account_id);
CREATE INDEX idx_events_scheduled_at ON public.events(scheduled_at);
CREATE INDEX idx_event_products_event_id ON public.event_products(event_id);
CREATE INDEX idx_event_products_product_id ON public.event_products(product_id);
CREATE INDEX idx_client_event_deliveries_client_id ON public.client_event_deliveries(client_id);
CREATE INDEX idx_client_event_deliveries_event_id ON public.client_event_deliveries(event_id);