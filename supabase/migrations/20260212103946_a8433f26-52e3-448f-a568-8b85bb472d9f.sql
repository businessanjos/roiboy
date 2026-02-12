
CREATE OR REPLACE FUNCTION sync_first_contact_date()
  RETURNS trigger AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL 
     AND (OLD.completed_at IS NULL)
     AND NEW.deal_id IS NOT NULL
     AND NEW.title ILIKE '%Primeiro Contato%' 
  THEN
    INSERT INTO deal_field_values (account_id, deal_id, field_id, value_date)
    VALUES (
      NEW.account_id,
      NEW.deal_id,
      '166fe351-b29b-4f08-b330-88f82c65f625',
      (NEW.completed_at AT TIME ZONE 'America/Sao_Paulo')::date
    )
    ON CONFLICT (deal_id, field_id)
    DO UPDATE SET value_date = (NEW.completed_at AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_sync_first_contact_date
  AFTER UPDATE ON internal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_first_contact_date();
