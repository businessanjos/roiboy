-- Criar tabela para histórico de atendimentos (timeline do cliente)
CREATE TABLE IF NOT EXISTS client_service_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_assignment_id UUID REFERENCES zapp_conversation_assignments(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES zapp_agents(id) ON DELETE SET NULL,
  agent_name VARCHAR(255),
  sector_id VARCHAR(50),
  department_name VARCHAR(255),
  outcome VARCHAR(50),
  summary TEXT,
  ai_summary TEXT,
  notes TEXT,
  duration_minutes INTEGER,
  messages_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE client_service_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view service history from their account"
ON client_service_history FOR SELECT
USING (account_id = (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert service history for their account"
ON client_service_history FOR INSERT
WITH CHECK (account_id = (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_client_service_history_client ON client_service_history(client_id);
CREATE INDEX idx_client_service_history_lead ON client_service_history(lead_id);
CREATE INDEX idx_client_service_history_account ON client_service_history(account_id);
CREATE INDEX idx_client_service_history_closed_at ON client_service_history(closed_at DESC);