INSERT INTO public.custom_fields (account_id, name, field_type, options, is_required, display_order, is_active, show_in_clients, show_in_leads, show_in_deals)
SELECT '796e7970-fd93-4574-a871-6090624cace6'::uuid, 'E-mail para envio da NF', 'text', '[]'::jsonb, false, 9004, true, false, false, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.custom_fields WHERE name = 'E-mail para envio da NF' AND account_id = '796e7970-fd93-4574-a871-6090624cace6'::uuid
);