ALTER TABLE public.ai_analysis_queue
  ADD COLUMN job_type TEXT NOT NULL DEFAULT 'ai_analysis',
  ADD COLUMN payload JSONB;