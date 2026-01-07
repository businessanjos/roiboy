-- Corrigir políticas permissivas em support_tickets e support_messages
-- Baseado na estrutura real: support_tickets usa account_id, não user_id

-- support_tickets - criar política baseada em account_id
DROP POLICY IF EXISTS "Users can create support tickets" ON support_tickets;

CREATE POLICY "Users can create support tickets in their account"
ON support_tickets FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin() 
  OR 
  account_id = get_user_account_id()
);

-- support_messages - criar política baseada no ticket da conta
DROP POLICY IF EXISTS "Users can insert messages in their tickets" ON support_messages;

CREATE POLICY "Users can insert messages in their account tickets"
ON support_messages FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin()
  OR
  EXISTS (
    SELECT 1 FROM support_tickets st
    WHERE st.id = support_messages.ticket_id
    AND st.account_id = get_user_account_id()
  )
);