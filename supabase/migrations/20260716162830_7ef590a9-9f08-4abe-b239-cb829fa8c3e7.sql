ALTER TABLE public.renewal_outcomes
DROP CONSTRAINT IF EXISTS renewal_outcomes_outcome_check;

ALTER TABLE public.renewal_outcomes
ADD CONSTRAINT renewal_outcomes_outcome_check
CHECK (outcome = ANY (ARRAY['renewed'::text, 'lost'::text, 'pending'::text, 'negotiating'::text]));