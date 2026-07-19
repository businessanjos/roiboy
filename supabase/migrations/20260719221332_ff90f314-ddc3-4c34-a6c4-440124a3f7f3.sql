
ALTER TABLE public.installment_events DROP CONSTRAINT IF EXISTS installment_events_event_type_check;
ALTER TABLE public.installment_events ADD CONSTRAINT installment_events_event_type_check
  CHECK (event_type = ANY (ARRAY['note','charge_attempt','message_sent','promise','renegotiation','dispute','judicial','bounce','partial_payment','full_payment','discount','write_off','status_change','check_status_change','card_status_change','lock','unlock','system','invoice_settled','contract_settled','cancellation_writeoff','payment_status_changed']));
