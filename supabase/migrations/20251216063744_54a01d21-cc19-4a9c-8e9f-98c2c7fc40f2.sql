-- Add 'financial' to roi_source enum
ALTER TYPE roi_source ADD VALUE IF NOT EXISTS 'financial';

-- Add 'financial' to risk_source enum  
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'financial';