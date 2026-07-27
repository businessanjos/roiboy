UPDATE public.user_royzapp_views
SET views = ARRAY['inbox','team','departments','tags','settings','playbook','marketing','sector','meetings']::text[],
    updated_at = now()
WHERE views IS NULL OR array_length(views,1) IS NULL OR views <@ ARRAY['inbox','team','tags','playbook']::text[];