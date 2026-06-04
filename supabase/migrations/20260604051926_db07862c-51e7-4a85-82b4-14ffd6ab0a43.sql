
-- ========= EVENT DESIGN FILES =========
CREATE TABLE public.event_design_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'outros',
  name text NOT NULL,
  description text,
  file_url text,
  external_url text,
  thumbnail_url text,
  file_size bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'wip',
  version integer NOT NULL DEFAULT 1,
  tags text[] DEFAULT '{}',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_design_files_event ON public.event_design_files(event_id);
CREATE INDEX idx_event_design_files_account ON public.event_design_files(account_id);
CREATE INDEX idx_event_design_files_category ON public.event_design_files(category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_design_files TO authenticated;
GRANT ALL ON public.event_design_files TO service_role;

ALTER TABLE public.event_design_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view event design files"
  ON public.event_design_files FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Account members can insert event design files"
  ON public.event_design_files FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can update event design files"
  ON public.event_design_files FOR UPDATE TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Account members can delete event design files"
  ON public.event_design_files FOR DELETE TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE TRIGGER trg_event_design_files_updated_at
  BEFORE UPDATE ON public.event_design_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= EVENT MEDIA ALBUMS =========
CREATE TABLE public.event_media_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  cover_url text,
  is_public boolean NOT NULL DEFAULT false,
  public_token text UNIQUE,
  allow_public_download boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_media_albums_event ON public.event_media_albums(event_id);
CREATE INDEX idx_event_media_albums_token ON public.event_media_albums(public_token) WHERE is_public = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_media_albums TO authenticated;
GRANT SELECT ON public.event_media_albums TO anon;
GRANT ALL ON public.event_media_albums TO service_role;

ALTER TABLE public.event_media_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage their albums"
  ON public.event_media_albums FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Public can view public albums by token"
  ON public.event_media_albums FOR SELECT TO anon
  USING (is_public = true AND public_token IS NOT NULL);

CREATE TRIGGER trg_event_media_albums_updated_at
  BEFORE UPDATE ON public.event_media_albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= ADD album_id + favorite/tags TO EXISTING event_media =========
ALTER TABLE public.event_media
  ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.event_media_albums(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_event_media_album ON public.event_media(album_id);

-- Allow public read of media when its album is public
GRANT SELECT ON public.event_media TO anon;

CREATE POLICY "Public can view media in public albums"
  ON public.event_media FOR SELECT TO anon
  USING (
    album_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.event_media_albums a
      WHERE a.id = event_media.album_id
        AND a.is_public = true
        AND a.public_token IS NOT NULL
    )
  );
