-- Create table for custom field folders
CREATE TABLE public.custom_field_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_expanded BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add folder_id to custom_fields table
ALTER TABLE public.custom_fields
ADD COLUMN folder_id UUID REFERENCES public.custom_field_folders(id) ON DELETE SET NULL;

-- Enable RLS on custom_field_folders
ALTER TABLE public.custom_field_folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for custom_field_folders
CREATE POLICY "Users can view folders from their account"
ON public.custom_field_folders
FOR SELECT
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create folders in their account"
ON public.custom_field_folders
FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update folders in their account"
ON public.custom_field_folders
FOR UPDATE
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete folders in their account"
ON public.custom_field_folders
FOR DELETE
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_custom_field_folders_account_id ON public.custom_field_folders(account_id);
CREATE INDEX idx_custom_fields_folder_id ON public.custom_fields(folder_id);

-- Create trigger for updated_at
CREATE TRIGGER update_custom_field_folders_updated_at
BEFORE UPDATE ON public.custom_field_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();