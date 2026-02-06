-- Adicionar coluna para vincular mentor ao evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS mentor_user_id uuid REFERENCES users(id);

-- Index para performance nas consultas por mentor
CREATE INDEX IF NOT EXISTS idx_events_mentor_user_id ON events(mentor_user_id);