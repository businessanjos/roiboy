-- Drop existing policies
DROP POLICY IF EXISTS "Users can view suppliers from their account" ON suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers in their account" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers in their account" ON suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers from their account" ON suppliers;

-- Recreate with correct auth check
CREATE POLICY "Users can view suppliers from their account" 
ON suppliers 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert suppliers in their account" 
ON suppliers 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update suppliers in their account" 
ON suppliers 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete suppliers from their account" 
ON suppliers 
FOR DELETE 
USING (account_id = get_user_account_id());