-- Create table to store multiple images per life event
CREATE TABLE public.client_life_event_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    life_event_id UUID NOT NULL REFERENCES public.client_life_events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_life_event_images_event ON public.client_life_event_images(life_event_id);

-- Enable RLS
ALTER TABLE public.client_life_event_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view images in their account"
ON public.client_life_event_images FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert images in their account"
ON public.client_life_event_images FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete images in their account"
ON public.client_life_event_images FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));