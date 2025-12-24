-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES public.users(id)
);

-- Create support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  sender_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'document')),
  external_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Super admin can see all tickets
CREATE POLICY "Super admins can view all tickets"
ON public.support_tickets FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Super admins can update tickets"
ON public.support_tickets FOR UPDATE
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (true);

CREATE POLICY "Super admins can view all messages"
ON public.support_messages FOR SELECT
USING (public.is_super_admin() OR EXISTS (
  SELECT 1 FROM public.support_tickets t 
  WHERE t.id = ticket_id
));

CREATE POLICY "Super admins can insert messages"
ON public.support_messages FOR INSERT
WITH CHECK (public.is_super_admin() OR true);

-- Create indexes
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_account ON public.support_tickets(account_id);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);

-- Updated at trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;