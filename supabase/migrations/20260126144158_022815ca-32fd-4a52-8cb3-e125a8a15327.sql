-- Criar tabela de cache de participantes de grupos WhatsApp
CREATE TABLE public.whatsapp_group_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  phone text NOT NULL,
  name text,
  is_admin boolean DEFAULT false,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, group_jid, phone)
);

-- Índices para performance
CREATE INDEX idx_group_participants_account ON whatsapp_group_participants(account_id);
CREATE INDEX idx_group_participants_phone ON whatsapp_group_participants(account_id, phone);
CREATE INDEX idx_group_participants_group ON whatsapp_group_participants(account_id, group_jid);

-- Habilitar RLS
ALTER TABLE whatsapp_group_participants ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem participantes da própria conta
CREATE POLICY "users_view_own_account_participants" ON whatsapp_group_participants
  FOR SELECT USING (account_id = get_my_account_id());