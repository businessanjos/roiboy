
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid;
  v_email text := 'felipes.canto@gmail.com';
  v_password text := 'Felipe@2026!';
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = v_email;
  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'Auth user already exists: %', v_existing;
    v_user_id := v_existing;
  ELSE
    SELECT account_id INTO v_account_id FROM public.users WHERE email='coachevertonsantos@gmail.com' LIMIT 1;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('name','Felipe Canto','full_name','Felipe Canto','is_team_member','true'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;

  SELECT account_id INTO v_account_id FROM public.users WHERE email='coachevertonsantos@gmail.com' LIMIT 1;

  IF EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = v_user_id) THEN
    UPDATE public.users
      SET role='admin', is_also_admin=true, account_id=v_account_id, name='Felipe Canto', email=v_email
      WHERE auth_user_id = v_user_id;
  ELSE
    INSERT INTO public.users (auth_user_id, account_id, name, email, role, is_also_admin)
    VALUES (v_user_id, v_account_id, 'Felipe Canto', v_email, 'admin', true);
  END IF;
END $$;
