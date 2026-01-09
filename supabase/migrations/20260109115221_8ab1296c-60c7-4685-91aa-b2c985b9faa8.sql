-- Fix UPDATE policy on deal_field_values to include WITH CHECK clause
DROP POLICY IF EXISTS "Users can update deal field values in their account" ON deal_field_values;

CREATE POLICY "Users can update deal field values in their account"
  ON deal_field_values FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));