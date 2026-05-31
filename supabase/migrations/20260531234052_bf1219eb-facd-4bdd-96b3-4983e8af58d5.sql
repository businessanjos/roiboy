
-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'hr-resumes';

-- Drop old broad policies
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete resumes" ON storage.objects;

-- INSERT: allow anyone (anon + authenticated) to upload ONLY when first folder
-- matches a real hr_jobs.id (prevents arbitrary file dumping into the bucket).
CREATE POLICY "Public applicants can upload resumes to valid job folders"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'hr-resumes'
  AND EXISTS (
    SELECT 1 FROM public.hr_jobs j
    WHERE j.id::text = (storage.foldername(name))[1]
  )
);

-- SELECT: only authenticated users belonging to the job's account
CREATE POLICY "Account members can view resumes for their jobs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hr-resumes'
  AND EXISTS (
    SELECT 1 FROM public.hr_jobs j
    WHERE j.id::text = (storage.foldername(name))[1]
      AND public.user_belongs_to_account(j.account_id)
  )
);

-- DELETE: same scope
CREATE POLICY "Account members can delete resumes for their jobs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hr-resumes'
  AND EXISTS (
    SELECT 1 FROM public.hr_jobs j
    WHERE j.id::text = (storage.foldername(name))[1]
      AND public.user_belongs_to_account(j.account_id)
  )
);
