-- Add appearance column to forms table for visual customization
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS appearance JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.forms.appearance IS 'JSON containing visual customization: logo_url, logo_position, background_type, background_color, gradient_start, gradient_end, card_background, primary_color, text_color, card_width, border_radius, show_title, title_alignment, footer_text, show_footer';

-- Create storage bucket for form assets (logos, images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-assets', 'form-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for form-assets bucket
CREATE POLICY "Users can upload form assets for their account"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update form assets for their account"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete form assets for their account"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'form-assets' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.account_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Form assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-assets');