-- Drop existing policies
DROP POLICY IF EXISTS "Users can view groups from their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can create groups for their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can update groups from their account" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can delete groups from their account" ON public.whatsapp_groups;

-- Create new policies using the same pattern as other tables
CREATE POLICY "Users can view whatsapp_groups in their account"
ON public.whatsapp_groups
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert whatsapp_groups in their account"
ON public.whatsapp_groups
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update whatsapp_groups in their account"
ON public.whatsapp_groups
FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete whatsapp_groups in their account"
ON public.whatsapp_groups
FOR DELETE
USING (account_id = get_user_account_id());