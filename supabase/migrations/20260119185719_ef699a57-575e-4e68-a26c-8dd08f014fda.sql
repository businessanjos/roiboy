-- Adicionar coluna visible_sectors para controlar visibilidade de eventos por setor
ALTER TABLE events 
ADD COLUMN visible_sectors JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.visible_sectors IS 
  'Array de sector_ids onde o evento será visível além do marketing';