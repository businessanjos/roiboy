-- Allow users to update roi_events in their account
CREATE POLICY "Users can update roi_events in their account" 
ON public.roi_events 
FOR UPDATE 
USING (account_id = get_user_account_id());

-- Allow users to delete roi_events in their account
CREATE POLICY "Users can delete roi_events in their account" 
ON public.roi_events 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Allow users to update risk_events in their account
CREATE POLICY "Users can update risk_events in their account" 
ON public.risk_events 
FOR UPDATE 
USING (account_id = get_user_account_id());

-- Allow users to delete risk_events in their account
CREATE POLICY "Users can delete risk_events in their account" 
ON public.risk_events 
FOR DELETE 
USING (account_id = get_user_account_id());