ALTER TABLE public.financial_faq_articles
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.financial_faq_articles
  DROP CONSTRAINT IF EXISTS financial_faq_articles_review_status_check;

ALTER TABLE public.financial_faq_articles
  ADD CONSTRAINT financial_faq_articles_review_status_check
  CHECK (review_status IN ('draft','in_review','published','changes_requested'));

UPDATE public.financial_faq_articles
  SET review_status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

CREATE OR REPLACE FUNCTION public.tg_faq_sync_publish_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_published := (NEW.review_status = 'published');
  IF TG_OP = 'UPDATE' AND NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    IF NEW.review_status = 'in_review' THEN
      NEW.submitted_at := now();
    ELSIF NEW.review_status IN ('published','changes_requested') THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faq_sync_publish_state ON public.financial_faq_articles;
CREATE TRIGGER trg_faq_sync_publish_state
  BEFORE INSERT OR UPDATE ON public.financial_faq_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_faq_sync_publish_state();