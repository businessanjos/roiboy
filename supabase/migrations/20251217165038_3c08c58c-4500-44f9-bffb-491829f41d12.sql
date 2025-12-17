-- Create forms table
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  require_client_info boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create form responses table
CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_name text,
  client_phone text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for forms (internal management)
CREATE POLICY "Users can view forms in their account" 
ON public.forms FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert forms in their account" 
ON public.forms FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update forms in their account" 
ON public.forms FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete forms in their account" 
ON public.forms FOR DELETE 
USING (account_id = get_user_account_id());

-- RLS policies for form_responses (internal viewing)
CREATE POLICY "Users can view responses in their account" 
ON public.form_responses FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete responses in their account" 
ON public.form_responses FOR DELETE 
USING (account_id = get_user_account_id());

-- Public policy for form responses (anyone can insert - public forms)
CREATE POLICY "Anyone can submit form responses" 
ON public.form_responses FOR INSERT 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();