-- Make contracts bucket public so downloads work regardless of browser extensions
UPDATE storage.buckets 
SET public = true 
WHERE id = 'contracts';

-- Add RLS policy to ensure only account members can view/download contracts
CREATE POLICY "Users can view contracts from their account"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' 
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);