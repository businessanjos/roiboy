UPDATE public.custom_fields
SET required_stages = '["won"]'::jsonb,
    updated_at = now()
WHERE id = 'ed5c7c0e-0740-4945-b982-70a593ffae0c';