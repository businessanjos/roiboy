-- Drop existing policies
DROP POLICY IF EXISTS "Users can view deal stages from their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can create deal stages in their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can update deal stages in their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can delete deal stages in their account" ON public.deal_stages;

-- Create new policies with explicit schema reference
CREATE POLICY "Users can view deal stages from their account" 
ON public.deal_stages 
FOR SELECT 
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can create deal stages in their account" 
ON public.deal_stages 
FOR INSERT 
WITH CHECK (
  account_id IN (
    SELECT u.account_id FROM public.users u WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can update deal stages in their account" 
ON public.deal_stages 
FOR UPDATE 
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can delete deal stages in their account" 
ON public.deal_stages 
FOR DELETE 
USING (
  account_id IN (
    SELECT u.account_id FROM public.users u WHERE u.id = auth.uid()
  )
);