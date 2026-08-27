DO $$
BEGIN
  DELETE FROM public.client_checkins cc
  WHERE cc.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = cc.user_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_checkins_user_id_fkey'
  ) THEN
    ALTER TABLE public.client_checkins
      ADD CONSTRAINT client_checkins_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;