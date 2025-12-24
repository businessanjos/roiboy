-- Tabela para configurações do Members Book por account
CREATE TABLE public.members_book_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    is_enabled boolean NOT NULL DEFAULT false,
    show_company boolean NOT NULL DEFAULT true,
    show_email boolean NOT NULL DEFAULT true,
    show_phone boolean NOT NULL DEFAULT true,
    show_products boolean NOT NULL DEFAULT true,
    custom_title text DEFAULT 'Members Book',
    custom_description text,
    access_password text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(account_id)
);

-- Tabela para controlar visibilidade individual de cada cliente no Members Book
CREATE TABLE public.members_book_visibility (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    is_visible boolean NOT NULL DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(account_id, client_id)
);

-- RLS para members_book_settings
ALTER TABLE public.members_book_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their account members book settings"
ON public.members_book_settings FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert their account members book settings"
ON public.members_book_settings FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update their account members book settings"
ON public.members_book_settings FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete their account members book settings"
ON public.members_book_settings FOR DELETE
USING (account_id = get_user_account_id());

-- RLS para members_book_visibility
ALTER TABLE public.members_book_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visibility in their account"
ON public.members_book_visibility FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert visibility in their account"
ON public.members_book_visibility FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update visibility in their account"
ON public.members_book_visibility FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete visibility in their account"
ON public.members_book_visibility FOR DELETE
USING (account_id = get_user_account_id());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_members_book_settings_updated_at
BEFORE UPDATE ON public.members_book_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_members_book_visibility_updated_at
BEFORE UPDATE ON public.members_book_visibility
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();