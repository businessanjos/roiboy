-- Create client_followups table for manual notes, files, and images
CREATE TABLE public.client_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'file', 'image')),
  title TEXT,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_followups ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view followups in their account" 
ON public.client_followups 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert followups in their account" 
ON public.client_followups 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update followups in their account" 
ON public.client_followups 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete followups in their account" 
ON public.client_followups 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Create index for faster queries
CREATE INDEX idx_client_followups_client_id ON public.client_followups(client_id);
CREATE INDEX idx_client_followups_created_at ON public.client_followups(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_client_followups_updated_at
BEFORE UPDATE ON public.client_followups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for followup files
INSERT INTO storage.buckets (id, name, public) VALUES ('client-followups', 'client-followups', false);

-- Storage policies for followup files
CREATE POLICY "Users can view their account followup files"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-followups' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload followup files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-followups' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete followup files"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-followups' AND auth.uid() IS NOT NULL);