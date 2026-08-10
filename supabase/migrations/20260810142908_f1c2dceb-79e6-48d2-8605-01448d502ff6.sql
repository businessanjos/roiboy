CREATE TABLE public.financial_faq_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_steps TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available',
  related_route TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT financial_faq_articles_status_check CHECK (status IN ('available', 'not_implemented', 'planned'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_faq_articles TO authenticated;
GRANT ALL ON public.financial_faq_articles TO service_role;

ALTER TABLE public.financial_faq_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view faq articles in their account"
  ON public.financial_faq_articles FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert faq articles in their account"
  ON public.financial_faq_articles FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update faq articles in their account"
  ON public.financial_faq_articles FOR UPDATE TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can delete faq articles in their account"
  ON public.financial_faq_articles FOR DELETE TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE INDEX idx_financial_faq_articles_account ON public.financial_faq_articles(account_id);
CREATE INDEX idx_financial_faq_articles_category ON public.financial_faq_articles(account_id, category);
CREATE INDEX idx_financial_faq_articles_question_trgm ON public.financial_faq_articles USING gin (question gin_trgm_ops);

CREATE TRIGGER trg_financial_faq_articles_updated_at
  BEFORE UPDATE ON public.financial_faq_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financial_faq_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  answered BOOLEAN NOT NULL DEFAULT false,
  matched_article_id UUID REFERENCES public.financial_faq_articles(id) ON DELETE SET NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.financial_faq_searches TO authenticated;
GRANT ALL ON public.financial_faq_searches TO service_role;

ALTER TABLE public.financial_faq_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view faq searches in their account"
  ON public.financial_faq_searches FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can log faq searches in their account"
  ON public.financial_faq_searches FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE INDEX idx_financial_faq_searches_account ON public.financial_faq_searches(account_id, created_at DESC);