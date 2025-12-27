-- Create private bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for backups bucket - only service role can access
CREATE POLICY "Service role can manage backups"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'backups')
WITH CHECK (bucket_id = 'backups');

-- Admins can view/download backups
CREATE POLICY "Admins can view backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = (SELECT get_user_account_id()::text)
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);