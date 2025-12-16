-- Create vnps_class enum
CREATE TYPE vnps_class AS ENUM ('detractor', 'neutral', 'promoter');

-- Create vnps_snapshots table
CREATE TABLE public.vnps_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vnps_score DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  vnps_class vnps_class NOT NULL DEFAULT 'detractor',
  roizometer INTEGER NOT NULL DEFAULT 0,
  escore INTEGER NOT NULL DEFAULT 0,
  risk_index INTEGER NOT NULL DEFAULT 0,
  trend trend_type NOT NULL DEFAULT 'flat',
  explanation TEXT,
  eligible_for_nps_ask BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_vnps_snapshots_client_id ON public.vnps_snapshots(client_id);
CREATE INDEX idx_vnps_snapshots_account_id ON public.vnps_snapshots(account_id);
CREATE INDEX idx_vnps_snapshots_computed_at ON public.vnps_snapshots(computed_at DESC);
CREATE INDEX idx_vnps_snapshots_vnps_class ON public.vnps_snapshots(vnps_class);
CREATE INDEX idx_vnps_snapshots_eligible ON public.vnps_snapshots(eligible_for_nps_ask) WHERE eligible_for_nps_ask = true;

-- Enable RLS
ALTER TABLE public.vnps_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view vnps_snapshots in their account" 
ON public.vnps_snapshots 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert vnps_snapshots in their account" 
ON public.vnps_snapshots 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

-- Enable realtime for vnps_snapshots
ALTER PUBLICATION supabase_realtime ADD TABLE public.vnps_snapshots;