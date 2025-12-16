-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
BEGIN
  -- Create a new account for the user
  INSERT INTO public.accounts (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  RETURNING id INTO new_account_id;
  
  -- Create the user profile
  INSERT INTO public.users (auth_user_id, account_id, email, name)
  VALUES (
    NEW.id,
    new_account_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Create default account settings
  INSERT INTO public.account_settings (account_id)
  VALUES (new_account_id);
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();