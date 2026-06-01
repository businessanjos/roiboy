
-- 1) Tornar buckets privados
UPDATE storage.buckets SET public = false WHERE id IN ('hr-documents', 'contracts', 'call-recordings');

-- 2) Remover policies permissivas/legadas
DROP POLICY IF EXISTS "Public read access for hr-documents" ON storage.objects;
DROP POLICY IF EXISTS "hr_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "hr_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "hr_docs_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recordings" ON storage.objects;

-- 3) hr-documents: scoped por account_id (primeira pasta do path)
CREATE POLICY "hr_docs_select_account"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "hr_docs_insert_account"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "hr_docs_update_account"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

CREATE POLICY "hr_docs_delete_account"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id()::text
);

-- 4) call-recordings: primeira pasta = session_id; validar via join em video_call_sessions
CREATE POLICY "call_recordings_select_account"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.video_call_sessions
    WHERE account_id = public.get_user_account_id()
  )
);

CREATE POLICY "call_recordings_insert_account"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.video_call_sessions
    WHERE account_id = public.get_user_account_id()
  )
);

CREATE POLICY "call_recordings_update_account"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.video_call_sessions
    WHERE account_id = public.get_user_account_id()
  )
);

CREATE POLICY "call_recordings_delete_account"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.video_call_sessions
    WHERE account_id = public.get_user_account_id()
  )
);

-- 5) contracts: já tem policies de SELECT/UPDATE/DELETE por account_id; garantir INSERT também
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Users can upload contracts to their account'
  ) THEN
    CREATE POLICY "Users can upload contracts to their account"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'contracts'
      AND (storage.foldername(name))[1] = public.get_user_account_id()::text
    );
  END IF;
END $$;
