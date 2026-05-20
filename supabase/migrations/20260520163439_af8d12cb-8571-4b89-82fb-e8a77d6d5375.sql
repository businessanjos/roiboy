
CREATE TABLE public.content_talents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  niche TEXT DEFAULT 'estetica',
  brand_voice TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE TABLE public.content_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  positioning TEXT,
  audience TEXT,
  tone TEXT,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  big_bets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(talent_id, year, quarter)
);

CREATE TABLE public.content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  mix_percentage INT NOT NULL DEFAULT 0,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  reference_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.content_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  format TEXT,
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'backlog',
  hook TEXT,
  script TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT,
  thumbnail_brief TEXT,
  briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_user_id UUID,
  published_url TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_pieces_account ON public.content_pieces(account_id);
CREATE INDEX idx_content_pieces_talent ON public.content_pieces(talent_id);
CREATE INDEX idx_content_pieces_scheduled ON public.content_pieces(scheduled_date);
CREATE INDEX idx_content_pieces_status ON public.content_pieces(status);

CREATE TABLE public.content_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  talent_id UUID REFERENCES public.content_talents(id) ON DELETE CASCADE,
  pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('hook','cta','hashtag','reference','idea')),
  content TEXT NOT NULL,
  platform TEXT,
  performance_score INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_talents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_talents','content_strategies','content_pillars','content_pieces','content_library_items']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_account_select" ON public.%1$s FOR SELECT TO authenticated
        USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
      CREATE POLICY "%1$s_account_insert" ON public.%1$s FOR INSERT TO authenticated
        WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
      CREATE POLICY "%1$s_account_update" ON public.%1$s FOR UPDATE TO authenticated
        USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
      CREATE POLICY "%1$s_account_delete" ON public.%1$s FOR DELETE TO authenticated
        USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
    $f$, t);
  END LOOP;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_talents','content_strategies','content_pillars','content_pieces','content_library_items']
  LOOP
    EXECUTE format($f$
      CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    $f$, t);
  END LOOP;
END $$;

INSERT INTO public.content_talents (account_id, name, slug, bio, niche)
SELECT a.id, 'Bruna', 'bruna', 'Talento da Eternum — perfil de conteúdo no nicho de estética.', 'estetica'
FROM public.accounts a
WHERE NOT EXISTS (SELECT 1 FROM public.content_talents ct WHERE ct.account_id = a.id AND ct.slug = 'bruna');

INSERT INTO public.content_talents (account_id, name, slug, bio, niche)
SELECT a.id, 'Everton', 'everton', 'Talento da Eternum — perfil de conteúdo no nicho de estética.', 'estetica'
FROM public.accounts a
WHERE NOT EXISTS (SELECT 1 FROM public.content_talents ct WHERE ct.account_id = a.id AND ct.slug = 'everton');
