-- Adicionar colunas para arquivos anexados na tabela deal_activities
ALTER TABLE deal_activities 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Criar bucket para armazenar arquivos de atividades de deals
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-activities', 'deal-activities', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket deal-activities
CREATE POLICY "Users can view deal activity files"
ON storage.objects FOR SELECT
USING (bucket_id = 'deal-activities');

CREATE POLICY "Users can upload deal activity files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deal-activities' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their deal activity files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'deal-activities' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their deal activity files"
ON storage.objects FOR DELETE
USING (bucket_id = 'deal-activities' AND auth.uid() IS NOT NULL);