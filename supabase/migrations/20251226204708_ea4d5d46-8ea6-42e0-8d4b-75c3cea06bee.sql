-- Create bucket for Zapp media if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('zapp-media', 'zapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to zapp-media bucket
CREATE POLICY "Public read access for zapp-media" ON storage.objects
FOR SELECT
USING (bucket_id = 'zapp-media');

-- Allow authenticated users to upload to their account folder
CREATE POLICY "Authenticated users can upload to zapp-media" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'zapp-media' AND auth.role() = 'authenticated');

-- Allow service role to upload (for edge functions)
CREATE POLICY "Service role can upload to zapp-media" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'zapp-media' AND auth.role() = 'service_role');