UPDATE public.deals
SET stage_id = '81b33c5c-74e5-47bd-bcab-b0eeb419aeae'
WHERE stage_id = '76e4dadc-286b-4302-a6d0-59698f45b70d';

DELETE FROM public.deal_stages WHERE id = '76e4dadc-286b-4302-a6d0-59698f45b70d';