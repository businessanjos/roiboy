ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS typeform_reapplication_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS typeform_last_reapplication_at timestamptz;
CREATE INDEX IF NOT EXISTS typeform_response_deal_submitted_idx ON public.typeform_responses(account_id, matched_deal_id, submitted_at) WHERE is_completed = true;
CREATE OR REPLACE FUNCTION public.refresh_typeform_deal_reapplications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.matched_deal_id IS NULL OR NEW.is_completed IS NOT TRUE THEN RETURN NEW; END IF;
  -- Recompute from persisted responses, so a webhook replay never increments twice.
  UPDATE public.deals d SET
    typeform_reapplication_count = x.total,
    typeform_last_reapplication_at = x.latest
  FROM (
    SELECT count(*)::integer AS total, max(r.submitted_at) AS latest
    FROM public.typeform_responses r
    JOIN public.deals target ON target.id = NEW.matched_deal_id AND target.account_id = NEW.account_id
    WHERE r.account_id = NEW.account_id AND r.matched_deal_id = target.id
      AND r.is_completed = true AND r.submitted_at > target.created_at
  ) x
  WHERE d.id = NEW.matched_deal_id AND d.account_id = NEW.account_id
    AND d.deleted_at IS NULL AND d.status = 'open'
    AND (d.typeform_reapplication_count IS DISTINCT FROM x.total OR d.typeform_last_reapplication_at IS DISTINCT FROM x.latest);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_typeform_deal_reapplications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_typeform_deal_reapplications() TO service_role;
CREATE TRIGGER typeform_deal_reapplication_signal
AFTER INSERT OR UPDATE OF matched_deal_id, is_completed, submitted_at ON public.typeform_responses
FOR EACH ROW EXECUTE FUNCTION public.refresh_typeform_deal_reapplications();
-- Backfill the new presentation fields without changing business state.
UPDATE public.deals d SET typeform_reapplication_count = x.total, typeform_last_reapplication_at = x.latest
FROM (
 SELECT target.id,count(*)::integer AS total,max(r.submitted_at) AS latest
 FROM public.deals target JOIN public.typeform_responses r ON r.matched_deal_id=target.id AND r.account_id=target.account_id
 WHERE target.deleted_at IS NULL AND target.status='open' AND r.is_completed=true AND r.submitted_at>target.created_at
 GROUP BY target.id
) x WHERE d.id=x.id;
COMMENT ON COLUMN public.deals.typeform_reapplication_count IS 'Completed Typeform submissions received after this deal was created; presentation-only, deduplicated by persisted response.';