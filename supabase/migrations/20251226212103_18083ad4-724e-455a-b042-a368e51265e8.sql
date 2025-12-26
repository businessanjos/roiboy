-- Create a cleanup function to remove old completed jobs (keep for 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_ai_analysis_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_analysis_queue 
  WHERE status IN ('completed', 'failed')
    AND completed_at < now() - interval '7 days';
END;
$$;

-- Create a function to get queue stats
CREATE OR REPLACE FUNCTION public.get_ai_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pending', (SELECT COUNT(*) FROM public.ai_analysis_queue WHERE status = 'pending'),
    'processing', (SELECT COUNT(*) FROM public.ai_analysis_queue WHERE status = 'processing'),
    'completed_today', (SELECT COUNT(*) FROM public.ai_analysis_queue WHERE status = 'completed' AND completed_at >= CURRENT_DATE),
    'failed_today', (SELECT COUNT(*) FROM public.ai_analysis_queue WHERE status = 'failed' AND completed_at >= CURRENT_DATE)
  ) INTO result;
  
  RETURN result;
END;
$$;