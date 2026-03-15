
-- Sales Materials table (linked to user_id + account_id)
CREATE TABLE public.sales_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sales materials"
  ON public.sales_materials
  FOR ALL
  TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());

-- Sales Playbooks table
CREATE TABLE public.sales_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  script_type TEXT NOT NULL DEFAULT 'cold_call',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  generated_from JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sales playbooks"
  ON public.sales_playbooks
  FOR ALL
  TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());

-- Sales Scripts table (shared per account)
CREATE TABLE public.sales_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  objection_type TEXT,
  funnel_stage TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sales scripts in their account"
  ON public.sales_scripts
  FOR ALL
  TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());

-- Sales Call Analyses table
CREATE TABLE public.sales_call_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL,
  transcript_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_call_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sales call analyses"
  ON public.sales_call_analyses
  FOR ALL
  TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());
