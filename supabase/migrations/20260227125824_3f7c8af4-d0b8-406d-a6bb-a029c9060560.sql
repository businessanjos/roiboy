
-- Remove MIME type restrictions from client-followups bucket
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'client-followups';

-- Remove MIME type restrictions from internal-chat-files bucket
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'internal-chat-files';
