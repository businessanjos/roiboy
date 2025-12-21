-- Add 'whatsapp' and 'liberty' to integration_type enum
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'liberty';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'ryka';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'omie';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'openai';