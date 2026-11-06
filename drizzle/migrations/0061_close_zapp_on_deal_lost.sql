CREATE OR REPLACE FUNCTION public.close_zapp_on_deal_lost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'lost' AND OLD.status IS DISTINCT FROM 'lost' AND NEW.lead_id IS NOT NULL AND NEW.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM deals d2 WHERE d2.lead_id = NEW.lead_id AND d2.id <> NEW.id AND d2.status = 'open' AND d2.deleted_at IS NULL) THEN
    UPDATE zapp_conversation_assignments a
       SET status = 'closed', closed_at = now(), agent_id = NULL, assigned_at = NULL,
           close_notes = COALESCE(a.close_notes, 'Finalizada automaticamente: negócio perdido')
      FROM zapp_conversations c
     WHERE a.zapp_conversation_id = c.id
       AND c.account_id = NEW.account_id
       AND c.lead_id = NEW.lead_id
       AND COALESCE(c.is_group, false) = false
       AND c.client_id IS NULL
       AND a.status <> 'closed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_close_zapp_on_deal_lost ON public.deals;
CREATE TRIGGER trg_close_zapp_on_deal_lost AFTER UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.close_zapp_on_deal_lost();