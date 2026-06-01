
-- 1) Drop overly-permissive legacy INSERT policy on hr-documents
DROP POLICY IF EXISTS "hr_docs_insert" ON storage.objects;

-- 2) Remove super_admins from Realtime publication to avoid leaking change metadata
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'super_admins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.super_admins';
  END IF;
END $$;
