-- Add logo_url column to bank_accounts
ALTER TABLE public.bank_accounts ADD COLUMN logo_url TEXT;

-- Create storage bucket for bank logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for bank logos bucket
CREATE POLICY "Users can upload bank logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their bank logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their bank logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Bank logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');