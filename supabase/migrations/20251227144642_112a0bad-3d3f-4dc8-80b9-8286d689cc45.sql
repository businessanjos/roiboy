-- Create table to manage user access to sectors and their roles within each sector
CREATE TABLE public.user_sector_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sector_id text NOT NULL,
  role_in_sector text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id, sector_id)
);

-- Add comment
COMMENT ON TABLE public.user_sector_access IS 'Manages which sectors each user can access and their role within each sector';
COMMENT ON COLUMN public.user_sector_access.sector_id IS 'Sector ID: operacoes, financeiro, royzapp, vendas, marketing, configuracoes';
COMMENT ON COLUMN public.user_sector_access.role_in_sector IS 'Role within the sector: admin, manager, member, viewer';

-- Create indexes
CREATE INDEX idx_user_sector_access_user ON public.user_sector_access(user_id);
CREATE INDEX idx_user_sector_access_sector ON public.user_sector_access(sector_id);
CREATE INDEX idx_user_sector_access_account ON public.user_sector_access(account_id);

-- Enable RLS
ALTER TABLE public.user_sector_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sector access in their account"
ON public.user_sector_access FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert sector access in their account"
ON public.user_sector_access FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update sector access in their account"
ON public.user_sector_access FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete sector access in their account"
ON public.user_sector_access FOR DELETE
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_user_sector_access_updated_at
BEFORE UPDATE ON public.user_sector_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();