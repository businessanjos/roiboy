-- ===========================================
-- 1. GESTÃO DE PARTICIPANTES (Convidados/RSVP)
-- ===========================================

-- Enum for RSVP status
CREATE TYPE public.event_rsvp_status AS ENUM ('pending', 'confirmed', 'declined', 'waitlist', 'attended', 'no_show');

-- Table for event participants/invitations
CREATE TABLE public.event_participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    -- For external guests not in clients table
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    rsvp_status public.event_rsvp_status NOT NULL DEFAULT 'pending',
    rsvp_responded_at TIMESTAMP WITH TIME ZONE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    invited_by UUID REFERENCES public.users(id),
    waitlist_position INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Ensure either client_id or guest_name is provided
    CONSTRAINT participant_identity CHECK (client_id IS NOT NULL OR guest_name IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view participants in their account" ON public.event_participants
    FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert participants in their account" ON public.event_participants
    FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update participants in their account" ON public.event_participants
    FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete participants in their account" ON public.event_participants
    FOR DELETE USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_event_participants_updated_at
    BEFORE UPDATE ON public.event_participants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_client ON public.event_participants(client_id);
CREATE INDEX idx_event_participants_rsvp ON public.event_participants(rsvp_status);

-- ===========================================
-- 2. EQUIPE DO EVENTO
-- ===========================================

-- Enum for team member roles in event
CREATE TYPE public.event_team_role AS ENUM ('organizer', 'coordinator', 'support', 'speaker', 'host', 'photographer', 'other');

-- Table for event team members
CREATE TABLE public.event_team (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role public.event_team_role NOT NULL DEFAULT 'support',
    role_description TEXT,
    responsibilities TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Prevent duplicate user per event
    UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_team ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view team in their account" ON public.event_team
    FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert team in their account" ON public.event_team
    FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update team in their account" ON public.event_team
    FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete team in their account" ON public.event_team
    FOR DELETE USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_event_team_updated_at
    BEFORE UPDATE ON public.event_team
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_event_team_event ON public.event_team(event_id);
CREATE INDEX idx_event_team_user ON public.event_team(user_id);

-- ===========================================
-- 3. PÓS-EVENTO: GALERIA DE MÍDIA
-- ===========================================

-- Enum for media type
CREATE TYPE public.event_media_type AS ENUM ('photo', 'video', 'document', 'other');

-- Table for event media/gallery
CREATE TABLE public.event_media (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    media_type public.event_media_type NOT NULL DEFAULT 'photo',
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    thumbnail_url TEXT,
    caption TEXT,
    uploaded_by UUID REFERENCES public.users(id),
    is_cover BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view media in their account" ON public.event_media
    FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert media in their account" ON public.event_media
    FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update media in their account" ON public.event_media
    FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete media in their account" ON public.event_media
    FOR DELETE USING (account_id = get_user_account_id());

-- Index for performance
CREATE INDEX idx_event_media_event ON public.event_media(event_id);

-- ===========================================
-- 4. PÓS-EVENTO: FEEDBACK/NPS
-- ===========================================

-- Table for event feedback
CREATE TABLE public.event_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    participant_id UUID REFERENCES public.event_participants(id) ON DELETE SET NULL,
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    content_rating INTEGER CHECK (content_rating >= 1 AND content_rating <= 5),
    organization_rating INTEGER CHECK (organization_rating >= 1 AND organization_rating <= 5),
    venue_rating INTEGER CHECK (venue_rating >= 1 AND venue_rating <= 5),
    highlights TEXT,
    improvements TEXT,
    additional_comments TEXT,
    would_recommend BOOLEAN,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback in their account" ON public.event_feedback
    FOR SELECT USING (account_id = get_user_account_id());
CREATE POLICY "Users can insert feedback in their account" ON public.event_feedback
    FOR INSERT WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users can update feedback in their account" ON public.event_feedback
    FOR UPDATE USING (account_id = get_user_account_id());
CREATE POLICY "Users can delete feedback in their account" ON public.event_feedback
    FOR DELETE USING (account_id = get_user_account_id());

-- Index for performance
CREATE INDEX idx_event_feedback_event ON public.event_feedback(event_id);
CREATE INDEX idx_event_feedback_client ON public.event_feedback(client_id);

-- ===========================================
-- 5. ADICIONAR CAMPOS AO EVENTO
-- ===========================================

-- Add max_capacity for waitlist feature
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_capacity INTEGER;

-- Create storage bucket for event media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-media', 'event-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-media bucket
CREATE POLICY "Anyone can view event media" ON storage.objects
    FOR SELECT USING (bucket_id = 'event-media');

CREATE POLICY "Authenticated users can upload event media" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their event media" ON storage.objects
    FOR UPDATE USING (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their event media" ON storage.objects
    FOR DELETE USING (bucket_id = 'event-media' AND auth.role() = 'authenticated');