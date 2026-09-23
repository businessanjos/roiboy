CREATE POLICY "ai_knowledge_docs_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ai-knowledge-docs');
CREATE POLICY "ai_knowledge_docs_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ai-knowledge-docs');
CREATE POLICY "ai_knowledge_docs_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ai-knowledge-docs')
  WITH CHECK (bucket_id = 'ai-knowledge-docs');
CREATE POLICY "ai_knowledge_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ai-knowledge-docs');