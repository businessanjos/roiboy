-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their session folder
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'call-recordings');

-- RLS: authenticated users can read recordings
CREATE POLICY "Authenticated users can read recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'call-recordings');

-- RLS: service role and authenticated users can update
CREATE POLICY "Authenticated users can update recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'call-recordings');