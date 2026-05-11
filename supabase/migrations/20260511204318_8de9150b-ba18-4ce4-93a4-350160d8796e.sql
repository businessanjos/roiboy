-- Create public bucket for cached Instagram avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-avatars', 'instagram-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
DROP POLICY IF EXISTS "Instagram avatars are publicly readable" ON storage.objects;
CREATE POLICY "Instagram avatars are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'instagram-avatars');

-- Authenticated users may overwrite (rare manual ops); service role bypasses RLS anyway
DROP POLICY IF EXISTS "Authenticated can manage instagram avatars" ON storage.objects;
CREATE POLICY "Authenticated can manage instagram avatars"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'instagram-avatars')
WITH CHECK (bucket_id = 'instagram-avatars');