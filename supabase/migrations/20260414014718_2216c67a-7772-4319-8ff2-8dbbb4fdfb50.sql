-- Create storage bucket for candidate resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hr-resumes', 'hr-resumes', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can view resumes"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-resumes');

-- Allow public upload (candidates applying without auth)
CREATE POLICY "Anyone can upload resumes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hr-resumes');

-- Allow authenticated users to delete resumes
CREATE POLICY "Authenticated users can delete resumes"
ON storage.objects FOR DELETE
USING (bucket_id = 'hr-resumes' AND auth.role() = 'authenticated');