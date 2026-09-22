DO $$
DECLARE v jsonb; cols text; sets text;
BEGIN
  SELECT old_values::jsonb INTO v FROM public.hr_collaborator_audit_log WHERE id = 'e9eef535-cdff-421f-9e5e-5ba03e786ad4';
  SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ')
    INTO sets
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'hr_collaborators'
     AND column_name NOT IN ('id','account_id','created_at');
  EXECUTE format(
    'UPDATE public.hr_collaborators c SET %s FROM (SELECT * FROM jsonb_populate_record(NULL::public.hr_collaborators, $1)) r WHERE c.id = $2',
    sets
  ) USING v, '23583490-d562-40d3-b2f6-9ff802ff60a3'::uuid;
END $$;