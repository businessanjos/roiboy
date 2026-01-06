-- Create a public bucket for RoyZapp media that needs to be sent via WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('zapp-media', 'zapp-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to this bucket
CREATE POLICY "Authenticated users can upload zapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'zapp-media');

-- Allow anyone to view zapp media (needed for UAZAPI to download)
CREATE POLICY "Public can view zapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'zapp-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete zapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'zapp-media');