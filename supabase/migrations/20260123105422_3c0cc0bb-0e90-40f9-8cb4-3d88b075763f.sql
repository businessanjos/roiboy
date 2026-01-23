-- Corrigir políticas do bucket form-assets
-- O problema: usando u.id ao invés de u.auth_user_id para comparar com auth.uid()

-- Remover políticas incorretas
DROP POLICY IF EXISTS "Users can upload form assets for their account" ON storage.objects;
DROP POLICY IF EXISTS "Users can update form assets for their account" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete form assets for their account" ON storage.objects;

-- Recriar política de INSERT com a coluna correta
CREATE POLICY "Users can upload form assets for their account"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);

-- Recriar política de UPDATE com a coluna correta
CREATE POLICY "Users can update form assets for their account"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);

-- Recriar política de DELETE com a coluna correta
CREATE POLICY "Users can delete form assets for their account"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);