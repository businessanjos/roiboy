-- Enable realtime for timeline-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roi_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recommendations;