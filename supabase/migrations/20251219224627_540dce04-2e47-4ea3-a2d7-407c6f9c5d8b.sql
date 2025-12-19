-- Update handle_new_user to set the account creator as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_account_id uuid;
BEGIN
  -- Create a new account for the user
  INSERT INTO public.accounts (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  RETURNING id INTO new_account_id;
  
  -- Create the user profile with admin role (account creator is always admin)
  INSERT INTO public.users (auth_user_id, account_id, email, name, role)
  VALUES (
    NEW.id,
    new_account_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'admin'
  );
  
  -- Create default account settings
  INSERT INTO public.account_settings (account_id)
  VALUES (new_account_id);
  
  RETURN NEW;
END;
$function$;