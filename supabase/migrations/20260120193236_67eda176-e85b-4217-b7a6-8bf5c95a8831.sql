-- Adicionar novos valores ao enum roi_source para tracking de eventos
ALTER TYPE roi_source ADD VALUE IF NOT EXISTS 'event_rsvp';
ALTER TYPE roi_source ADD VALUE IF NOT EXISTS 'event_attendance';

-- Adicionar novo valor ao enum risk_source para no-shows
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'event_no_show';