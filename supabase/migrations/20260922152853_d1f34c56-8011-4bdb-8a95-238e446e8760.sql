CREATE OR REPLACE FUNCTION public.pretty_person_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  w text;
  parts text[];
  out_parts text[] := '{}';
  lower_words text[] := ARRAY['de','da','das','do','dos','e','di','du','del','della','van','von','y'];
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RETURN _name; END IF;
  parts := regexp_split_to_array(btrim(regexp_replace(_name, '\s+', ' ', 'g')), ' ');
  FOREACH w IN ARRAY parts LOOP
    IF lower(w) = ANY(lower_words) AND array_length(out_parts,1) IS NOT NULL THEN
      out_parts := out_parts || lower(w);
    ELSIF w ~ '^[IVXLC]+$' AND length(w) > 1 THEN
      out_parts := out_parts || upper(w);
    ELSE
      out_parts := out_parts || (upper(left(w,1)) || lower(substr(w,2)));
    END IF;
  END LOOP;
  RETURN array_to_string(out_parts, ' ');
END;
$$;

UPDATE public.hr_collaborators SET full_name = public.pretty_person_name(full_name)
  WHERE full_name = upper(full_name) AND full_name ~ '[A-Z]';
UPDATE public.hr_service_providers SET full_name = public.pretty_person_name(full_name)
  WHERE full_name = upper(full_name) AND full_name ~ '[A-Z]';
UPDATE public.hr_partners SET full_name = public.pretty_person_name(full_name)
  WHERE full_name = upper(full_name) AND full_name ~ '[A-Z]';
UPDATE public.hr_job_applications SET candidate_name = public.pretty_person_name(candidate_name)
  WHERE candidate_name = upper(candidate_name) AND candidate_name ~ '[A-Z]';
UPDATE public.users SET name = public.pretty_person_name(name)
  WHERE name = upper(name) AND name ~ '[A-Z]';
UPDATE public.clients SET full_name = public.pretty_person_name(full_name)
  WHERE full_name = upper(full_name) AND full_name ~ '[A-Z]';
UPDATE public.leads SET full_name = public.pretty_person_name(full_name)
  WHERE full_name = upper(full_name) AND full_name ~ '[A-Z]';
UPDATE public.deals SET contact_name = public.pretty_person_name(contact_name)
  WHERE contact_name = upper(contact_name) AND contact_name ~ '[A-Z]';