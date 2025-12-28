-- Drop existing policies
DROP POLICY IF EXISTS "Users can view deal stages from their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can create deal stages in their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can update deal stages in their account" ON public.deal_stages;
DROP POLICY IF EXISTS "Users can delete deal stages in their account" ON public.deal_stages;

-- Drop and recreate policies for deals table too
DROP POLICY IF EXISTS "Users can view deals from their account" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals in their account" ON public.deals;
DROP POLICY IF EXISTS "Users can update deals in their account" ON public.deals;
DROP POLICY IF EXISTS "Users can delete deals in their account" ON public.deals;

DROP POLICY IF EXISTS "Users can view deal activities from their account" ON public.deal_activities;
DROP POLICY IF EXISTS "Users can create deal activities in their account" ON public.deal_activities;
DROP POLICY IF EXISTS "Users can update deal activities in their account" ON public.deal_activities;
DROP POLICY IF EXISTS "Users can delete deal activities in their account" ON public.deal_activities;

-- Create helper function to get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Create policies for deal_stages using the helper function
CREATE POLICY "Users can view deal stages from their account" 
ON public.deal_stages 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create deal stages in their account" 
ON public.deal_stages 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update deal stages in their account" 
ON public.deal_stages 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete deal stages in their account" 
ON public.deal_stages 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Create policies for deals
CREATE POLICY "Users can view deals from their account" 
ON public.deals 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create deals in their account" 
ON public.deals 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update deals in their account" 
ON public.deals 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete deals in their account" 
ON public.deals 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Create policies for deal_activities
CREATE POLICY "Users can view deal activities from their account" 
ON public.deal_activities 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can create deal activities in their account" 
ON public.deal_activities 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update deal activities in their account" 
ON public.deal_activities 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete deal activities in their account" 
ON public.deal_activities 
FOR DELETE 
USING (account_id = get_user_account_id());