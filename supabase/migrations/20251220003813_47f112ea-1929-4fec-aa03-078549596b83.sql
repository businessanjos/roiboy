-- Add new event types for mentorship and education businesses
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'mentoria';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'workshop';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'masterclass';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'webinar';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'imersao';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'plantao';