
-- Drop existing overly permissive storage policies for client-followups
DROP POLICY IF EXISTS "Users can view their account followup files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload followup files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete followup files" ON storage.objects;

-- Create account-isolated storage policies
-- Users can only access files in their account's folder
CREATE POLICY "Account isolated: view followup files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-followups' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Account isolated: upload followup files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-followups' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Account isolated: update followup files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'client-followups' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Account isolated: delete followup files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-followups' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);
