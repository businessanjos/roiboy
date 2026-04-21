-- Remove duplicatas mantendo o mais recente
DELETE FROM public.instagram_posts a
USING public.instagram_posts b
WHERE a.instagram_id IS NOT NULL
  AND a.instagram_id = b.instagram_id
  AND a.profile_id = b.profile_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_posts_profile_instagram_id_key
  ON public.instagram_posts (profile_id, instagram_id)
  WHERE instagram_id IS NOT NULL;