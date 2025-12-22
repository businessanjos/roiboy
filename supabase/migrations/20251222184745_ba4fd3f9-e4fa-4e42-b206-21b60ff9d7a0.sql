-- Create enum for relationship types
CREATE TYPE public.client_relationship_type AS ENUM ('spouse', 'partner', 'dependent', 'associate', 'other');

-- Create table for client relationships
CREATE TABLE public.client_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  primary_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  related_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  relationship_type client_relationship_type NOT NULL DEFAULT 'spouse',
  relationship_label TEXT, -- Custom label like "Esposa", "Sócio Majoritário"
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate relationships
  UNIQUE(account_id, primary_client_id, related_client_id),
  -- Prevent self-reference
  CHECK (primary_client_id != related_client_id)
);

-- Add indexes for performance
CREATE INDEX idx_client_relationships_primary ON public.client_relationships(primary_client_id);
CREATE INDEX idx_client_relationships_related ON public.client_relationships(related_client_id);
CREATE INDEX idx_client_relationships_account ON public.client_relationships(account_id);

-- Enable RLS
ALTER TABLE public.client_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view relationships in their account"
ON public.client_relationships FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert relationships in their account"
ON public.client_relationships FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update relationships in their account"
ON public.client_relationships FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete relationships in their account"
ON public.client_relationships FOR DELETE
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_client_relationships_updated_at
BEFORE UPDATE ON public.client_relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get all related clients (including reverse relationships)
CREATE OR REPLACE FUNCTION public.get_related_clients(p_client_id UUID)
RETURNS TABLE (
  client_id UUID,
  relationship_type client_relationship_type,
  relationship_label TEXT,
  is_primary BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get clients where this client is primary
  SELECT 
    related_client_id AS client_id,
    relationship_type,
    relationship_label,
    false AS is_primary
  FROM public.client_relationships
  WHERE primary_client_id = p_client_id
    AND is_active = true
    AND account_id = get_user_account_id()
  
  UNION ALL
  
  -- Get clients where this client is related (reverse lookup)
  SELECT 
    primary_client_id AS client_id,
    relationship_type,
    relationship_label,
    true AS is_primary
  FROM public.client_relationships
  WHERE related_client_id = p_client_id
    AND is_active = true
    AND account_id = get_user_account_id()
$$;