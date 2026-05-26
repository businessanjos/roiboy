-- ============ Storage bucket privado ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('rebranding-assets', 'rebranding-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Helper para checar account_id por path ({account_id}/...)
-- Usaremos a 1a pasta do path como account_id
CREATE POLICY "rebranding_assets_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'rebranding-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "rebranding_assets_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rebranding-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "rebranding_assets_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'rebranding-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "rebranding_assets_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'rebranding-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT account_id::text FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- ============ Tabela rebranding_assets ============
CREATE TABLE public.rebranding_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  channel_id UUID REFERENCES public.rebranding_channels(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  asset_kind TEXT NOT NULL DEFAULT 'spec',
  asset_label TEXT NOT NULL,
  asset_dimensions TEXT,
  asset_format TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  notes TEXT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  source TEXT NOT NULL DEFAULT 'upload',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rebranding_assets_kind_check CHECK (asset_kind IN ('spec','extra')),
  CONSTRAINT rebranding_assets_status_check CHECK (status IN ('draft','review','approved','rejected')),
  CONSTRAINT rebranding_assets_source_check CHECK (source IN ('upload','ai'))
);

CREATE INDEX idx_rebranding_assets_account ON public.rebranding_assets(account_id);
CREATE INDEX idx_rebranding_assets_channel ON public.rebranding_assets(channel_key, account_id);

ALTER TABLE public.rebranding_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rebranding_assets_account_all" ON public.rebranding_assets
FOR ALL TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_rebranding_assets_updated
BEFORE UPDATE ON public.rebranding_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_rebranding_updated_at();

-- ============ Tabela rebranding_ai_generations ============
CREATE TABLE public.rebranding_ai_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  user_id UUID,
  user_name TEXT,
  channel_key TEXT,
  asset_label TEXT,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-pro-image-preview',
  aspect_ratio TEXT,
  width INTEGER,
  height INTEGER,
  palette JSONB,
  reference_files JSONB,
  file_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  saved_as_asset_id UUID REFERENCES public.rebranding_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rebranding_ai_generations_account ON public.rebranding_ai_generations(account_id, created_at DESC);

ALTER TABLE public.rebranding_ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rebranding_ai_generations_account_all" ON public.rebranding_ai_generations
FOR ALL TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));