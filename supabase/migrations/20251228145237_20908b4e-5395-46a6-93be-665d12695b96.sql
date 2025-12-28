-- Create storage bucket for internal chat files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('internal-chat-files', 'internal-chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for internal chat files
CREATE POLICY "Users can upload files to their account folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'internal-chat-files' 
  AND (storage.foldername(name))[1] = get_user_account_id()::text
);

CREATE POLICY "Users can view files from their account"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'internal-chat-files' 
  AND (storage.foldername(name))[1] = get_user_account_id()::text
);

CREATE POLICY "Users can delete files from their account"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'internal-chat-files' 
  AND (storage.foldername(name))[1] = get_user_account_id()::text
);