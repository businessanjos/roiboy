
-- 1) Drop hardcoded-UUID backdoor policies on Google Drive tables
DROP POLICY IF EXISTS "Only Maikol can access gdrive connections" ON public.google_drive_connections;
DROP POLICY IF EXISTS "Only Maikol can access gdrive folders" ON public.google_drive_folders;

-- Replace with super_admin-scoped administrative access
CREATE POLICY "Super admins can manage gdrive connections"
ON public.google_drive_connections
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage gdrive folders"
ON public.google_drive_folders
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 2) Tighten instagram-avatars bucket write policies to account-scoped folders
DROP POLICY IF EXISTS "Authenticated can manage instagram avatars" ON storage.objects;

CREATE POLICY "Users can upload instagram avatars in own account folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'instagram-avatars'
  AND (storage.foldername(name))[1] = (public.get_current_user_account_id())::text
);

CREATE POLICY "Users can update instagram avatars in own account folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'instagram-avatars'
  AND (storage.foldername(name))[1] = (public.get_current_user_account_id())::text
)
WITH CHECK (
  bucket_id = 'instagram-avatars'
  AND (storage.foldername(name))[1] = (public.get_current_user_account_id())::text
);

CREATE POLICY "Users can delete instagram avatars in own account folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'instagram-avatars'
  AND (storage.foldername(name))[1] = (public.get_current_user_account_id())::text
);
