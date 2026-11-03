ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS previous_lost_deal_id uuid;
COMMENT ON COLUMN public.deals.previous_lost_deal_id IS 'Most recent lost deal of the same contact when a form re-application opened this deal.';
CREATE OR REPLACE FUNCTION public.refresh_typeform_deal_reapplications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.matched_deal_id IS NULL OR NEW.is_completed IS NOT TRUE THEN RETURN NEW; END IF;
  UPDATE public.deals d SET
    typeform_reapplication_count = x.total,
    typeform_last_reapplication_at = x.latest
  FROM (
    SELECT count(*)::integer AS total, max(r.submitted_at) AS latest
    FROM public.typeform_responses r
    JOIN public.deals target ON target.id = NEW.matched_deal_id AND target.account_id = NEW.account_id
    WHERE r.account_id = NEW.account_id AND r.matched_deal_id = target.id
      AND r.is_completed = true
      AND (r.submitted_at > target.created_at OR target.previous_lost_deal_id IS NOT NULL)
  ) x
  WHERE d.id = NEW.matched_deal_id AND d.account_id = NEW.account_id
    AND d.deleted_at IS NULL AND d.status = 'open'
    AND (d.typeform_reapplication_count IS DISTINCT FROM x.total OR d.typeform_last_reapplication_at IS DISTINCT FROM x.latest);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_typeform_deal_reapplications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_typeform_deal_reapplications() TO service_role;