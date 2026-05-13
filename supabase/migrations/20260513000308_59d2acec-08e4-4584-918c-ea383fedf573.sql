UPDATE public.omie_settings
SET legal_name = COALESCE(NULLIF(legal_name, ''), 'Eternum Mentoring Club Ltda'),
    trade_name = COALESCE(NULLIF(trade_name, ''), 'Eternum Club')
WHERE cnpj = '53844206000164';