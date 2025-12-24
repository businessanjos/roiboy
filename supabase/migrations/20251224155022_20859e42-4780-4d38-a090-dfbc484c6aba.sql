-- =============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =============================================

-- Índices para queries do Dashboard (useDashboardData)
-- Score snapshots: busca por client_id ordenado por computed_at
CREATE INDEX IF NOT EXISTS idx_score_snapshots_client_computed 
ON public.score_snapshots(client_id, computed_at DESC);

-- VNPS snapshots: busca por client_id ordenado por computed_at
CREATE INDEX IF NOT EXISTS idx_vnps_snapshots_client_computed 
ON public.vnps_snapshots(client_id, computed_at DESC);

-- Risk events: busca por client_id ordenado por happened_at
CREATE INDEX IF NOT EXISTS idx_risk_events_client_happened 
ON public.risk_events(client_id, happened_at DESC);

-- ROI events: busca por account_id e happened_at (últimos 30 dias)
CREATE INDEX IF NOT EXISTS idx_roi_events_account_happened 
ON public.roi_events(account_id, happened_at DESC);

-- Risk events: busca por account_id e happened_at (últimos 30 dias)
CREATE INDEX IF NOT EXISTS idx_risk_events_account_happened 
ON public.risk_events(account_id, happened_at DESC);

-- Recommendations: busca por client_id e status open
CREATE INDEX IF NOT EXISTS idx_recommendations_client_status 
ON public.recommendations(client_id, status, created_at DESC);

-- Índices para queries de Clientes (useClientsData)
-- Client products: busca por client_id
CREATE INDEX IF NOT EXISTS idx_client_products_client 
ON public.client_products(client_id);

-- Message events: busca por client_id ordenado por sent_at
CREATE INDEX IF NOT EXISTS idx_message_events_client_sent 
ON public.message_events(client_id, sent_at DESC);

-- Conversations: busca por client_id
CREATE INDEX IF NOT EXISTS idx_conversations_client 
ON public.conversations(client_id);

-- Client field values: busca por client_id
CREATE INDEX IF NOT EXISTS idx_client_field_values_client 
ON public.client_field_values(client_id);

-- Client form sends: busca pendentes por client_id
CREATE INDEX IF NOT EXISTS idx_client_form_sends_pending 
ON public.client_form_sends(client_id, form_id) 
WHERE responded_at IS NULL;

-- Índices para queries de Life Events
CREATE INDEX IF NOT EXISTS idx_life_events_date 
ON public.client_life_events(event_date) 
WHERE event_date IS NOT NULL;

-- Índices para Support (SupportTicketsManager)
CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
ON public.support_tickets(status, needs_human_attention, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket 
ON public.support_messages(ticket_id, created_at ASC);

-- Índices para Knowledge Base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active 
ON public.support_knowledge_base(is_active, category);

-- Índices para Notificações (usando is_read)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON public.notifications(user_id, is_read, created_at DESC);

-- Índices para Tasks (usando custom_status_id em vez de status_id)
CREATE INDEX IF NOT EXISTS idx_internal_tasks_assigned 
ON public.internal_tasks(assigned_to, custom_status_id, due_date);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_client 
ON public.internal_tasks(client_id, custom_status_id);

-- Índices para Events
CREATE INDEX IF NOT EXISTS idx_events_scheduled 
ON public.events(account_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_participants_event_rsvp 
ON public.event_participants(event_id, rsvp_status);

-- Índice para busca de clientes (full-text search)
CREATE INDEX IF NOT EXISTS idx_clients_search 
ON public.clients USING GIN (to_tsvector('portuguese', full_name || ' ' || COALESCE(company_name, '')));

-- Índice para clients por account_id e created_at
CREATE INDEX IF NOT EXISTS idx_clients_account_created 
ON public.clients(account_id, created_at DESC);

-- Índice para clients por status
CREATE INDEX IF NOT EXISTS idx_clients_account_status 
ON public.clients(account_id, status);