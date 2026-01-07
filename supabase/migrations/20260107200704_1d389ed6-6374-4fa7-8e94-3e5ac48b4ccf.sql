-- Remover políticas antigas permissivas que ainda existem

-- support_tickets - remover política antiga com "true"
DROP POLICY IF EXISTS "Super admins can insert tickets" ON support_tickets;

-- support_messages - remover política antiga com "is_super_admin() OR true"
DROP POLICY IF EXISTS "Super admins can insert messages" ON support_messages;