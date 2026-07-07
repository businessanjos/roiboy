CREATE OR REPLACE FUNCTION public.create_collaborator_from_admission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_department_id uuid;
BEGIN
  IF NEW.stage = 'admitted' AND (OLD.stage IS DISTINCT FROM 'admitted') THEN
    -- Try to find an existing collaborator for this account by email or full name
    SELECT id INTO v_existing_id
    FROM public.hr_collaborators
    WHERE account_id = NEW.account_id
      AND (
        (NEW.candidate_email IS NOT NULL AND lower(email) = lower(NEW.candidate_email))
        OR lower(full_name) = lower(NEW.candidate_name)
      )
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.hr_collaborators
      SET status = 'active',
          hire_date = COALESCE(hire_date, NEW.start_date, CURRENT_DATE),
          position = COALESCE(position, NEW.position_title),
          department = COALESCE(department, NEW.department),
          employment_type = COALESCE(employment_type, NEW.contract_type),
          phone = COALESCE(phone, NEW.candidate_phone),
          avatar_url = COALESCE(avatar_url, NEW.candidate_photo_url),
          email = COALESCE(email, NEW.candidate_email),
          updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      SELECT id INTO v_department_id
      FROM public.hr_departments
      WHERE account_id = NEW.account_id
        AND NEW.department IS NOT NULL
        AND lower(name) = lower(NEW.department)
      LIMIT 1;

      INSERT INTO public.hr_collaborators (
        account_id, full_name, email, phone, avatar_url,
        department, hr_department_id, position, employment_type,
        hire_date, status, source_note
      ) VALUES (
        NEW.account_id, NEW.candidate_name, NEW.candidate_email, NEW.candidate_phone, NEW.candidate_photo_url,
        NEW.department, v_department_id, NEW.position_title, NEW.contract_type,
        COALESCE(NEW.start_date, CURRENT_DATE), 'active',
        'Criado automaticamente pela admissão ' || NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_admissions_create_collaborator ON public.hr_admissions;
CREATE TRIGGER trg_hr_admissions_create_collaborator
AFTER UPDATE ON public.hr_admissions
FOR EACH ROW
EXECUTE FUNCTION public.create_collaborator_from_admission();

-- Backfill: for any admission already at stage 'admitted' without a matching collaborator
INSERT INTO public.hr_collaborators (
  account_id, full_name, email, phone, avatar_url,
  department, position, employment_type, hire_date, status, source_note
)
SELECT a.account_id, a.candidate_name, a.candidate_email, a.candidate_phone, a.candidate_photo_url,
       a.department, a.position_title, a.contract_type,
       COALESCE(a.start_date, a.admitted_at::date, CURRENT_DATE), 'active',
       'Backfill da admissão ' || a.id::text
FROM public.hr_admissions a
WHERE a.stage = 'admitted'
  AND NOT EXISTS (
    SELECT 1 FROM public.hr_collaborators c
    WHERE c.account_id = a.account_id
      AND (
        (a.candidate_email IS NOT NULL AND lower(c.email) = lower(a.candidate_email))
        OR lower(c.full_name) = lower(a.candidate_name)
      )
  );