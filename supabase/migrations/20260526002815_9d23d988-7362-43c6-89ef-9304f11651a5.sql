UPDATE public.rebranding_channels
SET url = 'https://eternum-club.lovable.app',
    status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
    notes = COALESCE(NULLIF(notes, ''), 'Site provisório no Lovable (eternum-club.lovable.app) enquanto domínio definitivo não é publicado.')
WHERE name = 'Site Institucional';