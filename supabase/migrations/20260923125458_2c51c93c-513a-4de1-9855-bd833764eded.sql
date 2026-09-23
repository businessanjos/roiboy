CREATE TABLE public.ai_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_knowledge_chunks TO authenticated;
GRANT ALL ON public.ai_knowledge_chunks TO service_role;

ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_chunks_select" ON public.ai_knowledge_chunks
  FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());

CREATE INDEX idx_ai_knowledge_chunks_doc ON public.ai_knowledge_chunks(document_id, chunk_index);
CREATE INDEX idx_ai_knowledge_chunks_account ON public.ai_knowledge_chunks(account_id);