-- Reativar o campo de Instagram para que apareça novamente nos negócios
UPDATE custom_fields
SET is_active = true, updated_at = now()
WHERE id = '47df969b-735e-414f-a25e-2a56e589551d';