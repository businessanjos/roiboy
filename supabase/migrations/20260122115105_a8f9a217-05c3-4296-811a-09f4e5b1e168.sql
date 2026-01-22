-- Adicionar coluna para armazenar URLs de anexos
ALTER TABLE public.marketing_tasks 
ADD COLUMN IF NOT EXISTS media_attachments JSONB DEFAULT '[]'::jsonb;

-- Criar bucket para mídias de tarefas de marketing
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-task-media', 'marketing-task-media', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket
CREATE POLICY "Authenticated users can upload marketing media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-task-media');

CREATE POLICY "Anyone can view marketing media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'marketing-task-media');

CREATE POLICY "Users can delete their marketing media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-task-media');