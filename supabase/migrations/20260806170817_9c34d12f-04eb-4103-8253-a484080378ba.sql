UPDATE public.user_royzapp_views
SET zapp_sectors = ARRAY['vendas','operacoes'],
    updated_at = now()
WHERE user_id = '1232ec15-5f66-4b5f-9e74-f40d436f9d0f';