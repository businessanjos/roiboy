UPDATE storage.buckets SET public = true WHERE id = 'hr-documents';

CREATE POLICY "Public read access for hr-documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-documents');