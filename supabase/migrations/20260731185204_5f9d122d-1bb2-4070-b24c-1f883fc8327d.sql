UPDATE public.insights_visuals
SET chart_type = 'bar',
    config = jsonb_set(config, '{chartOrientation}', '"vertical"', true)
WHERE id = '14166e52-4ab3-4934-9a08-c0ca4f58d2eb';