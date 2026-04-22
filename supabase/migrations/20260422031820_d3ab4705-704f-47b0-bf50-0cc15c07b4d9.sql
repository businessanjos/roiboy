CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_by UUID,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage gdrive connections in their account"
ON public.google_drive_connections
FOR ALL
TO authenticated
USING (
  account_id = public.get_current_user_account_id()
  AND public.is_account_owner(auth.uid())
)
WITH CHECK (
  account_id = public.get_current_user_account_id()
  AND public.is_account_owner(auth.uid())
);

CREATE TRIGGER update_google_drive_connections_updated_at
BEFORE UPDATE ON public.google_drive_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.google_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.google_drive_connections(id) ON DELETE CASCADE,
  drive_folder_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  seller_name TEXT,
  is_shared_drive BOOLEAN NOT NULL DEFAULT false,
  shared_drive_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_page_token TEXT,
  files_synced_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, drive_folder_id)
);

ALTER TABLE public.google_drive_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage gdrive folders in their account"
ON public.google_drive_folders
FOR ALL
TO authenticated
USING (
  account_id = public.get_current_user_account_id()
  AND public.is_account_owner(auth.uid())
)
WITH CHECK (
  account_id = public.get_current_user_account_id()
  AND public.is_account_owner(auth.uid())
);

CREATE TRIGGER update_google_drive_folders_updated_at
BEFORE UPDATE ON public.google_drive_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_gdrive_folders_account ON public.google_drive_folders(account_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_folders_connection ON public.google_drive_folders(connection_id);