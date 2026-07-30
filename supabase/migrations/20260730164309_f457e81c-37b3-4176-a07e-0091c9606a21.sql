CREATE OR REPLACE FUNCTION public.set_ec_mentoring_attendance_recorded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.recorded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ec_mentoring_attendance_recorded_by ON public.ec_mentoring_attendance;
CREATE TRIGGER trg_set_ec_mentoring_attendance_recorded_by
BEFORE INSERT OR UPDATE ON public.ec_mentoring_attendance
FOR EACH ROW
EXECUTE FUNCTION public.set_ec_mentoring_attendance_recorded_by();