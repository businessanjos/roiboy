ALTER TABLE public.mi_competitors
  ALTER COLUMN website DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS competitor_type text NOT NULL DEFAULT 'direto',
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS name_confidence text,
  ADD COLUMN IF NOT EXISTS mentors text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS positioning text;

ALTER TABLE public.mi_competitors
  DROP CONSTRAINT IF EXISTS mi_competitors_competitor_type_check;
ALTER TABLE public.mi_competitors
  ADD CONSTRAINT mi_competitors_competitor_type_check CHECK (competitor_type IN ('direto','indireto','transversal'));