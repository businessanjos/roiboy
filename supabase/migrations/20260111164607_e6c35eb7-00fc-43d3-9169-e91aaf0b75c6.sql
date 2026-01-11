-- Adicionar coluna pin_hash na tabela sector_settings
ALTER TABLE sector_settings 
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

COMMENT ON COLUMN sector_settings.pin_hash IS 'Hash bcrypt do PIN de acesso ao setor';