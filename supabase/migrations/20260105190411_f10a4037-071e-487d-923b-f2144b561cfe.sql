-- =====================================================
-- Playbook System: Sales Team Quick Messages & Media
-- =====================================================

-- 1. Create playbook_folders table
CREATE TABLE public.playbook_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create playbook_items table
CREATE TABLE public.playbook_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.playbook_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'audio', 'image', 'video', 'document', 'sticker', 'list')),
  -- Text content
  text_content TEXT,
  -- Media content (audio, image, video, document)
  media_url TEXT,
  media_filename TEXT,
  media_size INTEGER,
  media_duration INTEGER, -- for audio/video in seconds
  -- List content (for structured lists)
  list_items JSONB,
  -- Metadata
  position INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on playbook_folders
ALTER TABLE public.playbook_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playbook_folders in their account"
  ON public.playbook_folders FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert playbook_folders in their account"
  ON public.playbook_folders FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update playbook_folders in their account"
  ON public.playbook_folders FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete playbook_folders in their account"
  ON public.playbook_folders FOR DELETE
  USING (account_id = get_user_account_id());

-- 4. Enable RLS on playbook_items
ALTER TABLE public.playbook_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playbook_items in their account"
  ON public.playbook_items FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert playbook_items in their account"
  ON public.playbook_items FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update playbook_items in their account"
  ON public.playbook_items FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete playbook_items in their account"
  ON public.playbook_items FOR DELETE
  USING (account_id = get_user_account_id());

-- 5. Create storage bucket for playbook media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'playbook-media', 
  'playbook-media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- 6. Storage policies for playbook-media bucket
CREATE POLICY "Users can view playbook media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'playbook-media');

CREATE POLICY "Authenticated users can upload playbook media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'playbook-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their playbook media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'playbook-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete playbook media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'playbook-media' AND auth.role() = 'authenticated');

-- 7. Performance indexes
CREATE INDEX idx_playbook_folders_account ON public.playbook_folders(account_id);
CREATE INDEX idx_playbook_items_account ON public.playbook_items(account_id);
CREATE INDEX idx_playbook_items_folder ON public.playbook_items(folder_id);
CREATE INDEX idx_playbook_items_content_type ON public.playbook_items(account_id, content_type);
CREATE INDEX idx_playbook_items_favorite ON public.playbook_items(account_id, is_favorite) WHERE is_favorite = true;

-- 8. Trigger for updated_at
CREATE TRIGGER update_playbook_folders_updated_at
  BEFORE UPDATE ON public.playbook_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playbook_items_updated_at
  BEFORE UPDATE ON public.playbook_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();