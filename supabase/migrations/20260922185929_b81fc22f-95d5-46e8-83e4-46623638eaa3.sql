CREATE OR REPLACE FUNCTION public.apply_offboarding_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.stage = 'completed' AND (OLD.stage IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());

    IF NEW.collaborator_id IS NOT NULL THEN
      UPDATE public.hr_collaborators
        SET status = 'inactive',
            termination_date = COALESCE(NEW.termination_date, CURRENT_DATE),
            updated_at = now()
        WHERE id = NEW.collaborator_id
        RETURNING user_id INTO v_user_id;
    END IF;

    IF NEW.service_provider_id IS NOT NULL THEN
      UPDATE public.hr_service_providers
        SET status = 'inactive',
            termination_date = COALESCE(NEW.termination_date, CURRENT_DATE),
            updated_at = now()
        WHERE id = NEW.service_provider_id
        RETURNING user_id INTO v_user_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
      BEGIN
        UPDATE public.users SET is_active = false, updated_at = now() WHERE id = v_user_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF NEW.stage = 'cancelled' AND (OLD.stage IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.hr_service_providers sp
SET status = 'inactive',
    termination_date = COALESCE(sp.termination_date, o.termination_date, CURRENT_DATE),
    updated_at = now()
FROM public.hr_offboardings o
WHERE o.service_provider_id = sp.id
  AND o.stage = 'completed'
  AND sp.status <> 'inactive';