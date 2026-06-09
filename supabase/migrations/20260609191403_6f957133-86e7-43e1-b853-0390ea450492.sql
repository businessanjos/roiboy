-- 1) Add flag
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_generate_content BOOLEAN NOT NULL DEFAULT false;

-- 2) Trigger: auto-create default content deliverables when flag is true
CREATE OR REPLACE FUNCTION public.create_default_event_content_deliverables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_date DATE;
BEGIN
  IF NEW.auto_generate_content IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- Skip if already has deliverables (idempotent for updates)
  IF EXISTS (SELECT 1 FROM public.event_content_deliverables WHERE event_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  base_date := NEW.scheduled_at::date;

  INSERT INTO public.event_content_deliverables
    (account_id, event_id, kind, title, due_offset_days, due_date, status, sort_order)
  VALUES
    (NEW.account_id, NEW.id, 'save_the_date',     'Save the date',           -30, base_date - 30, 'todo', 0),
    (NEW.account_id, NEW.id, 'teaser',            'Teaser de divulgação',    -14, base_date - 14, 'todo', 1),
    (NEW.account_id, NEW.id, 'reels',             'Reels de aquecimento',     -7, base_date - 7,  'todo', 2),
    (NEW.account_id, NEW.id, 'stories',           'Stories de bastidores',    -1, base_date - 1,  'todo', 3),
    (NEW.account_id, NEW.id, 'cobertura_ao_vivo', 'Cobertura ao vivo',         0, base_date,      'todo', 4),
    (NEW.account_id, NEW.id, 'carrossel',         'Carrossel pós-evento',      3, base_date + 3,  'todo', 5),
    (NEW.account_id, NEW.id, 'pos_evento',        'Relato / aprendizados',     7, base_date + 7,  'todo', 6);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_auto_content ON public.events;
CREATE TRIGGER trg_event_auto_content
  AFTER INSERT OR UPDATE OF auto_generate_content ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.create_default_event_content_deliverables();

-- 3) Trigger: when deliverable marked done with a linked content_piece, publish it
CREATE OR REPLACE FUNCTION public.mark_linked_pauta_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done'
     AND (OLD.status IS DISTINCT FROM 'done')
     AND NEW.content_piece_id IS NOT NULL THEN
    UPDATE public.content_pieces
       SET status = 'published',
           updated_at = now()
     WHERE id = NEW.content_piece_id
       AND status <> 'published';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deliverable_publish_pauta ON public.event_content_deliverables;
CREATE TRIGGER trg_deliverable_publish_pauta
  AFTER UPDATE OF status ON public.event_content_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.mark_linked_pauta_published();