
-- ============================================
-- MARKETING IDEAS BOARD
-- ============================================
CREATE TABLE public.marketing_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'reel' CHECK (format IN ('reel','post','story','carousel','youtube_short','youtube_long','tiktok','live','other')),
  platform TEXT NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram','tiktok','youtube','linkedin','multi','other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','in_production','scheduled','posted','archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  planned_date DATE,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  caption TEXT,
  tags TEXT[] DEFAULT '{}',
  trend_id UUID,
  reference_ids UUID[] DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_ideas_account ON public.marketing_ideas(account_id);
CREATE INDEX idx_marketing_ideas_status ON public.marketing_ideas(account_id, status);
CREATE INDEX idx_marketing_ideas_planned_date ON public.marketing_ideas(account_id, planned_date);

-- ============================================
-- IDEA ASSIGNEES (multiple per idea)
-- ============================================
CREATE TABLE public.marketing_idea_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'designer' CHECK (role IN ('designer','social_media','videomaker','copywriter','strategist','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(idea_id, user_id, role)
);

CREATE INDEX idx_marketing_idea_assignees_idea ON public.marketing_idea_assignees(idea_id);
CREATE INDEX idx_marketing_idea_assignees_user ON public.marketing_idea_assignees(user_id);

-- ============================================
-- IDEA CHECKLIST (production stages)
-- ============================================
CREATE TABLE public.marketing_idea_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.marketing_ideas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_idea_checklist_idea ON public.marketing_idea_checklist(idea_id);

-- ============================================
-- TRENDS RADAR
-- ============================================
CREATE TABLE public.marketing_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','tiktok','instagram','youtube','perplexity','apify','other')),
  source_url TEXT,
  thumbnail_url TEXT,
  audio_name TEXT,
  views_count BIGINT,
  likes_count BIGINT,
  shares_count BIGINT,
  hype_score INTEGER CHECK (hype_score BETWEEN 0 AND 100),
  tags TEXT[] DEFAULT '{}',
  ai_adaptation TEXT,
  ai_analysis JSONB,
  captured_by UUID REFERENCES auth.users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_trends_account ON public.marketing_trends(account_id);
CREATE INDEX idx_marketing_trends_hype ON public.marketing_trends(account_id, hype_score DESC);

-- Add FK for trend_id on ideas now that trends exists
ALTER TABLE public.marketing_ideas
  ADD CONSTRAINT marketing_ideas_trend_fk
  FOREIGN KEY (trend_id) REFERENCES public.marketing_trends(id) ON DELETE SET NULL;

-- ============================================
-- REFERENCE BOARDS (mood boards / collections)
-- ============================================
CREATE TABLE public.marketing_reference_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  color TEXT DEFAULT '#a855f7',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_reference_boards_account ON public.marketing_reference_boards(account_id);

-- ============================================
-- REFERENCES (visual library)
-- ============================================
CREATE TABLE public.marketing_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.marketing_reference_boards(id) ON DELETE SET NULL,
  title TEXT,
  type TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','link','file')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  storage_path TEXT,
  source_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  color_palette TEXT[] DEFAULT '{}',
  width INTEGER,
  height INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_references_account ON public.marketing_references(account_id);
CREATE INDEX idx_marketing_references_board ON public.marketing_references(board_id);

-- ============================================
-- COPY HISTORY (AI-generated copies)
-- ============================================
CREATE TABLE public.marketing_copy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES public.marketing_ideas(id) ON DELETE SET NULL,
  copy_type TEXT NOT NULL DEFAULT 'caption' CHECK (copy_type IN ('caption','script','hook','cta','title','bio','email','other')),
  prompt TEXT NOT NULL,
  output TEXT NOT NULL,
  context JSONB,
  model TEXT DEFAULT 'google/gemini-2.5-pro',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_copy_history_account ON public.marketing_copy_history(account_id);
CREATE INDEX idx_marketing_copy_history_favorites ON public.marketing_copy_history(account_id, is_favorite) WHERE is_favorite = true;

-- ============================================
-- BRAND VOICE (learned from Instagram)
-- ============================================
CREATE TABLE public.marketing_brand_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  personality TEXT,
  tone_keywords TEXT[] DEFAULT '{}',
  forbidden_words TEXT[] DEFAULT '{}',
  example_posts TEXT[] DEFAULT '{}',
  target_audience TEXT,
  niche TEXT,
  values_and_mission TEXT,
  signature_phrases TEXT[] DEFAULT '{}',
  emoji_style TEXT,
  hashtag_strategy TEXT,
  ai_summary TEXT,
  learned_from_instagram_at TIMESTAMPTZ,
  posts_analyzed_count INTEGER DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER update_marketing_ideas_updated_at BEFORE UPDATE ON public.marketing_ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_trends_updated_at BEFORE UPDATE ON public.marketing_trends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_reference_boards_updated_at BEFORE UPDATE ON public.marketing_reference_boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_references_updated_at BEFORE UPDATE ON public.marketing_references FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_brand_voice_updated_at BEFORE UPDATE ON public.marketing_brand_voice FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.marketing_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_idea_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_reference_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_copy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_brand_voice ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES — marketing_ideas
-- ============================================
CREATE POLICY "Users view ideas in their account" ON public.marketing_ideas FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users create ideas in their account" ON public.marketing_ideas FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update ideas in their account" ON public.marketing_ideas FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete ideas in their account" ON public.marketing_ideas FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- RLS POLICIES — marketing_idea_assignees
-- ============================================
CREATE POLICY "Users view assignees in their account" ON public.marketing_idea_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users insert assignees in their account" ON public.marketing_idea_assignees FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users update assignees in their account" ON public.marketing_idea_assignees FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users delete assignees in their account" ON public.marketing_idea_assignees FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));

-- ============================================
-- RLS POLICIES — marketing_idea_checklist
-- ============================================
CREATE POLICY "Users view checklist in their account" ON public.marketing_idea_checklist FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users insert checklist in their account" ON public.marketing_idea_checklist FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users update checklist in their account" ON public.marketing_idea_checklist FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));
CREATE POLICY "Users delete checklist in their account" ON public.marketing_idea_checklist FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.marketing_ideas i WHERE i.id = idea_id AND i.account_id = public.get_current_user_account_id()));

-- ============================================
-- RLS POLICIES — marketing_trends
-- ============================================
CREATE POLICY "Users view trends in their account" ON public.marketing_trends FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users insert trends in their account" ON public.marketing_trends FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update trends in their account" ON public.marketing_trends FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete trends in their account" ON public.marketing_trends FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- RLS POLICIES — marketing_reference_boards
-- ============================================
CREATE POLICY "Users view boards in their account" ON public.marketing_reference_boards FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users insert boards in their account" ON public.marketing_reference_boards FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update boards in their account" ON public.marketing_reference_boards FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete boards in their account" ON public.marketing_reference_boards FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- RLS POLICIES — marketing_references
-- ============================================
CREATE POLICY "Users view references in their account" ON public.marketing_references FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users insert references in their account" ON public.marketing_references FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update references in their account" ON public.marketing_references FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete references in their account" ON public.marketing_references FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- RLS POLICIES — marketing_copy_history
-- ============================================
CREATE POLICY "Users view copy history in their account" ON public.marketing_copy_history FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users insert copy history in their account" ON public.marketing_copy_history FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update copy history in their account" ON public.marketing_copy_history FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete copy history in their account" ON public.marketing_copy_history FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- RLS POLICIES — marketing_brand_voice
-- ============================================
CREATE POLICY "Users view brand voice in their account" ON public.marketing_brand_voice FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users insert brand voice in their account" ON public.marketing_brand_voice FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Users update brand voice in their account" ON public.marketing_brand_voice FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Users delete brand voice in their account" ON public.marketing_brand_voice FOR DELETE
  USING (account_id = public.get_current_user_account_id());

-- ============================================
-- STORAGE BUCKET — marketing-references
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-references',
  'marketing-references',
  false,
  52428800, -- 50MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Account members read marketing references" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'marketing-references'
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text
  );
CREATE POLICY "Account members upload marketing references" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'marketing-references'
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text
  );
CREATE POLICY "Account members update marketing references" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'marketing-references'
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text
  );
CREATE POLICY "Account members delete marketing references" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'marketing-references'
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text
  );
