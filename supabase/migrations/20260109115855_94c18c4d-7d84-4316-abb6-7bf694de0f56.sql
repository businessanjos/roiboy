-- Fix RLS policies on deal_field_values to use auth_user_id instead of id

-- 1. Fix INSERT Policy
DROP POLICY IF EXISTS "Users can insert deal field values in their account" ON deal_field_values;
CREATE POLICY "Users can insert deal field values in their account"
  ON deal_field_values FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

-- 2. Fix SELECT Policy
DROP POLICY IF EXISTS "Users can view deal field values from their account" ON deal_field_values;
CREATE POLICY "Users can view deal field values from their account"
  ON deal_field_values FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

-- 3. Fix DELETE Policy
DROP POLICY IF EXISTS "Users can delete deal field values in their account" ON deal_field_values;
CREATE POLICY "Users can delete deal field values in their account"
  ON deal_field_values FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));