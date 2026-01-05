-- Add new event types to the enum
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'movimento';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'launch';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'campaign';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'content';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'partnership';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'fair';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'other';