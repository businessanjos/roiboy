-- Atualizar limite do bucket client-followups para 100MB
UPDATE storage.buckets 
SET file_size_limit = 104857600
WHERE id = 'client-followups';

-- Garantir que mime types de áudio são permitidos
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
WHERE id = 'client-followups';