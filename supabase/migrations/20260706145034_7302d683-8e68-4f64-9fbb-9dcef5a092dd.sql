
-- 1) Move users from extra accounts to Eternum Club
UPDATE public.users
SET account_id = '796e7970-fd93-4574-a871-6090624cace6'
WHERE account_id IN (
  '7abbb257-7cd2-449b-854a-c31a202d540c',  -- Natalia
  'ba4eab57-9e1d-41b8-a703-e49a7e6b40c4'   -- Grupo Ryka
);

-- 2) Purge seeded data from the 3 extra accounts
DO $$
DECLARE
  extras uuid[] := ARRAY[
    '7abbb257-7cd2-449b-854a-c31a202d540c'::uuid,
    'd606856a-697a-45be-9e98-7405994b74a9'::uuid,
    'ba4eab57-9e1d-41b8-a703-e49a7e6b40c4'::uuid
  ];
BEGIN
  DELETE FROM public.zapp_agents         WHERE account_id = ANY(extras);
  DELETE FROM public.zapp_departments    WHERE account_id = ANY(extras);
  DELETE FROM public.products            WHERE account_id = ANY(extras);
  DELETE FROM public.deal_loss_sub_reasons WHERE account_id = ANY(extras);
  DELETE FROM public.deal_loss_reasons   WHERE account_id = ANY(extras);
  DELETE FROM public.team_roles          WHERE account_id = ANY(extras);
  DELETE FROM public.task_statuses       WHERE account_id = ANY(extras);
  DELETE FROM public.financial_categories WHERE account_id = ANY(extras);
  DELETE FROM public.account_settings    WHERE account_id = ANY(extras);
  DELETE FROM public.accounts            WHERE id = ANY(extras);
END $$;

-- 3) Lock down handle_new_user: only team invites or explicitly allowed signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
BEGIN
  -- Team member invites bypass account creation
  IF NEW.raw_user_meta_data->>'is_team_member' = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only allow new workspace creation when explicitly flagged
  IF COALESCE(NEW.raw_user_meta_data->>'allow_new_workspace', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Cadastro bloqueado: novas contas s\303\263 podem ser criadas via convite de equipe. Peça ao administrador que envie um convite.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.accounts (name, trial_ends_at, subscription_status)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    now() + interval '7 days',
    'trial'
  )
  RETURNING id INTO new_account_id;

  INSERT INTO public.users (auth_user_id, account_id, email, name, role)
  VALUES (
    NEW.id,
    new_account_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'admin'
  );

  INSERT INTO public.account_settings (account_id)
  VALUES (new_account_id);

  RETURN NEW;
END;
$$;
