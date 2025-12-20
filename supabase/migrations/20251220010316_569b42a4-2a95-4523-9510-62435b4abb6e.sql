-- Performance indexes for frequently queried columns

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_account_status ON public.clients(account_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_account_created ON public.clients(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone_e164);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients(account_id, full_name);

-- Score snapshots - frequently joined with clients
CREATE INDEX IF NOT EXISTS idx_score_snapshots_client ON public.score_snapshots(client_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_account_computed ON public.score_snapshots(account_id, computed_at DESC);

-- Message events - high volume table
CREATE INDEX IF NOT EXISTS idx_message_events_client_sent ON public.message_events(client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_events_account_sent ON public.message_events(account_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_events_source ON public.message_events(account_id, source);

-- ROI events
CREATE INDEX IF NOT EXISTS idx_roi_events_client ON public.roi_events(client_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_events_account ON public.roi_events(account_id, happened_at DESC);

-- Risk events
CREATE INDEX IF NOT EXISTS idx_risk_events_client ON public.risk_events(client_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_account ON public.risk_events(account_id, happened_at DESC);

-- Recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_client ON public.recommendations(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(account_id, status);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_client ON public.attendance(client_id, join_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON public.attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(live_session_id);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON public.events(account_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(account_id, event_type);

-- Internal tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.internal_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON public.internal_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.internal_tasks(account_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.internal_tasks(account_id, status);

-- Client contracts
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.client_contracts(client_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.client_contracts(account_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.client_contracts(end_date);

-- Client life events
CREATE INDEX IF NOT EXISTS idx_life_events_client ON public.client_life_events(client_id, event_date);
CREATE INDEX IF NOT EXISTS idx_life_events_type ON public.client_life_events(account_id, event_type);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Security audit logs
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event ON public.security_audit_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON public.security_audit_logs(user_id, created_at DESC);

-- AI usage logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_account_date ON public.ai_usage_logs(account_id, created_at DESC);

-- Client products
CREATE INDEX IF NOT EXISTS idx_client_products_product ON public.client_products(product_id);

-- Forms and responses
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON public.form_responses(form_id, submitted_at DESC);

-- Client field values
CREATE INDEX IF NOT EXISTS idx_field_values_client ON public.client_field_values(client_id);
CREATE INDEX IF NOT EXISTS idx_field_values_field ON public.client_field_values(field_id);

-- User sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint ON public.user_sessions(device_fingerprint);