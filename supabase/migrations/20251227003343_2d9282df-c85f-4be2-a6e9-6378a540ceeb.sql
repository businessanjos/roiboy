-- Fix event_participants RLS policies - change from public to authenticated
-- This prevents anonymous users from accessing event participant data

-- Drop existing policies that allow public access
DROP POLICY IF EXISTS "Users can delete participants in their account" ON public.event_participants;
DROP POLICY IF EXISTS "Users can insert participants in their account" ON public.event_participants;
DROP POLICY IF EXISTS "Users can update participants in their account" ON public.event_participants;
DROP POLICY IF EXISTS "Users can view participants in their account" ON public.event_participants;

-- Recreate policies with authenticated role only
CREATE POLICY "Users can view participants in their account" 
ON public.event_participants 
FOR SELECT 
TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert participants in their account" 
ON public.event_participants 
FOR INSERT 
TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update participants in their account" 
ON public.event_participants 
FOR UPDATE 
TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete participants in their account" 
ON public.event_participants 
FOR DELETE 
TO authenticated
USING (account_id = get_user_account_id());