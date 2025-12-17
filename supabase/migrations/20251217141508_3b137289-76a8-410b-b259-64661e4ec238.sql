-- Add image_url column to roi_events for storing screenshot attachments
ALTER TABLE public.roi_events ADD COLUMN image_url TEXT;

-- Create a storage bucket for ROI screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('roi-screenshots', 'roi-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload ROI screenshots
CREATE POLICY "Users can upload ROI screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'roi-screenshots' AND auth.role() = 'authenticated');

-- Allow authenticated users to view ROI screenshots
CREATE POLICY "Users can view ROI screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'roi-screenshots' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their ROI screenshots
CREATE POLICY "Users can delete ROI screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'roi-screenshots' AND auth.role() = 'authenticated');