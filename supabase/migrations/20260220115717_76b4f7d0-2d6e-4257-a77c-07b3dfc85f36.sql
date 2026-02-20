ALTER TABLE public.insights_share_access_requests
  ADD COLUMN request_count integer NOT NULL DEFAULT 1;