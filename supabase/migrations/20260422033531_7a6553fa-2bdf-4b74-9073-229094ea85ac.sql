-- Restringe acesso ao Google Drive apenas ao usuário Maikol (auth_user_id específico)
DROP POLICY IF EXISTS "Owners manage gdrive connections in their account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Owners view gdrive connections in their account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Owners insert gdrive connections in their account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Owners update gdrive connections in their account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Owners delete gdrive connections in their account" ON public.google_drive_connections;

CREATE POLICY "Only Maikol can access gdrive connections"
ON public.google_drive_connections
FOR ALL
TO authenticated
USING (auth.uid() = '72ae91bc-0d35-4574-b9ea-76aa866296a3'::uuid)
WITH CHECK (auth.uid() = '72ae91bc-0d35-4574-b9ea-76aa866296a3'::uuid);

-- Faz o mesmo para a tabela de pastas vinculadas (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='google_drive_folders') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Owners manage gdrive folders in their account" ON public.google_drive_folders';
    EXECUTE 'DROP POLICY IF EXISTS "Owners view gdrive folders in their account" ON public.google_drive_folders';
    EXECUTE 'DROP POLICY IF EXISTS "Owners insert gdrive folders in their account" ON public.google_drive_folders';
    EXECUTE 'DROP POLICY IF EXISTS "Owners update gdrive folders in their account" ON public.google_drive_folders';
    EXECUTE 'DROP POLICY IF EXISTS "Owners delete gdrive folders in their account" ON public.google_drive_folders';
    EXECUTE $p$
      CREATE POLICY "Only Maikol can access gdrive folders"
      ON public.google_drive_folders
      FOR ALL
      TO authenticated
      USING (auth.uid() = '72ae91bc-0d35-4574-b9ea-76aa866296a3'::uuid)
      WITH CHECK (auth.uid() = '72ae91bc-0d35-4574-b9ea-76aa866296a3'::uuid)
    $p$;
  END IF;
END $$;