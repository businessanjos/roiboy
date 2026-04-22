ALTER TABLE public.google_drive_connections
ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.google_drive_connections
SET user_id = connected_by
WHERE user_id IS NULL;

ALTER TABLE public.google_drive_connections
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.google_drive_connections
DROP CONSTRAINT IF EXISTS google_drive_connections_account_id_key;

ALTER TABLE public.google_drive_connections
ADD CONSTRAINT google_drive_connections_account_user_key UNIQUE (account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_google_drive_connections_account_user
ON public.google_drive_connections (account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_google_drive_connections_user_id
ON public.google_drive_connections (user_id);

ALTER TABLE public.google_drive_folders
DROP CONSTRAINT IF EXISTS google_drive_folders_connection_id_fkey;

ALTER TABLE public.google_drive_folders
ADD CONSTRAINT google_drive_folders_connection_id_fkey
FOREIGN KEY (connection_id)
REFERENCES public.google_drive_connections(id)
ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view google drive connections in account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can insert google drive connections in account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can update google drive connections in account" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Users can delete google drive connections in account" ON public.google_drive_connections;

CREATE POLICY "Users can view their own google drive connection"
ON public.google_drive_connections
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own google drive connection"
ON public.google_drive_connections
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own google drive connection"
ON public.google_drive_connections
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own google drive connection"
ON public.google_drive_connections
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view google drive folders in account" ON public.google_drive_folders;
DROP POLICY IF EXISTS "Users can insert google drive folders in account" ON public.google_drive_folders;
DROP POLICY IF EXISTS "Users can update google drive folders in account" ON public.google_drive_folders;
DROP POLICY IF EXISTS "Users can delete google drive folders in account" ON public.google_drive_folders;

CREATE POLICY "Users can view their own google drive folders"
ON public.google_drive_folders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.google_drive_connections c
    WHERE c.id = google_drive_folders.connection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own google drive folders"
ON public.google_drive_folders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.google_drive_connections c
    WHERE c.id = google_drive_folders.connection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own google drive folders"
ON public.google_drive_folders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.google_drive_connections c
    WHERE c.id = google_drive_folders.connection_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.google_drive_connections c
    WHERE c.id = google_drive_folders.connection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own google drive folders"
ON public.google_drive_folders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.google_drive_connections c
    WHERE c.id = google_drive_folders.connection_id
      AND c.user_id = auth.uid()
  )
);