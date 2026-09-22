CREATE OR REPLACE FUNCTION public.log_pda_field_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  f text;
  fields text[] := ARRAY[
    'pda_hierarchy','pda_level','pda_role_profile','pda_dominant_profile','pda_secondary_profile',
    'pda_pdi_done','pda_pdi_delivered','pda_effort_level','pda_change_quality','pda_phase',
    'pda_temperament','pda_mental_model','pda_thermometer','pda_education','position',
    'registration_company','manager_id','status','termination_date',
    'pda_sectors','net_salary','salary_without_charges','salary_with_charges'
  ];
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
  ov text;
  nv text;
  actor uuid;
  actor_name text;
BEGIN
  SELECT u.id, u.name INTO actor, actor_name FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  FOREACH f IN ARRAY fields LOOP
    IF (oldj ? f) AND (newj ? f) THEN
      ov := oldj ->> f;
      nv := newj ->> f;
      IF ov IS DISTINCT FROM nv THEN
        INSERT INTO public.hr_pda_field_history (account_id, person_id, source_table, field_key, old_value, new_value, changed_by, changed_by_name)
        VALUES (NEW.account_id, NEW.id, TG_TABLE_NAME, f, ov, nv, actor, actor_name);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;