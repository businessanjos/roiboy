-- Create storage bucket for desktop app downloads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('app-downloads', 'app-downloads', true, 524288000)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to app downloads
CREATE POLICY "Public can read app downloads"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-downloads');

-- Only authenticated admins can upload app files
CREATE POLICY "Admins can upload app downloads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-downloads' 
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
);

CREATE POLICY "Admins can update app downloads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'app-downloads' 
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
);

CREATE POLICY "Admins can delete app downloads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'app-downloads' 
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'admin'
  )
);