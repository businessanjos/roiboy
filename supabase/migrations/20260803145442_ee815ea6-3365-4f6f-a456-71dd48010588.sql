CREATE OR REPLACE FUNCTION public.close_job_on_admission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'admitted' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'admitted') AND NEW.job_id IS NOT NULL THEN
    UPDATE public.hr_jobs
    SET status = 'closed',
        closed_at = COALESCE(closed_at, now()),
        updated_at = now()
    WHERE id = NEW.job_id
      AND status <> 'closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_job_on_admission ON public.hr_admissions;
CREATE TRIGGER trg_close_job_on_admission
AFTER INSERT OR UPDATE OF stage ON public.hr_admissions
FOR EACH ROW EXECUTE FUNCTION public.close_job_on_admission();