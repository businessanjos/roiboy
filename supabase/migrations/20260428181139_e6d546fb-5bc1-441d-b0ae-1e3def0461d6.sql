-- Cria custom fields para Dados de Faturamento (NF) e Mentorado, exibidos na modal Ganha do deal
INSERT INTO public.custom_fields (account_id, name, field_type, options, is_required, display_order, is_active, show_in_clients, show_in_leads, show_in_deals)
SELECT '796e7970-fd93-4574-a871-6090624cace6'::uuid, name, field_type, options::jsonb, false, display_order, true, false, false, true
FROM (VALUES
  ('Tipo de Pessoa (NF)', 'select', '[{"value":"cpf","label":"CPF"},{"value":"cnpj","label":"CNPJ"}]', 9001),
  ('CPF/CNPJ (NF)', 'text', '[]', 9002),
  ('Razão Social / Nome (NF)', 'text', '[]', 9003),
  ('E-mail para envio da NF', 'text', '[]', 9004),
  ('Mentorado - Nome', 'text', '[]', 9005),
  ('Mentorado - Telefone', 'text', '[]', 9006),
  ('Mentorado - E-mail', 'text', '[]', 9007)
) AS t(name, field_type, options, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.custom_fields cf WHERE cf.name = t.name AND cf.account_id = '796e7970-fd93-4574-a871-6090624cace6'::uuid
);