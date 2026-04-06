-- Add INSERT policy for contracts storage bucket
CREATE POLICY "Users can upload contracts to their account folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] IN (
    SELECT accounts.id::text FROM accounts WHERE accounts.id = get_user_account_id()
  )
);

-- Add UPDATE policy for contracts storage bucket  
CREATE POLICY "Users can update their account contracts"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] IN (
    SELECT accounts.id::text FROM accounts WHERE accounts.id = get_user_account_id()
  )
);