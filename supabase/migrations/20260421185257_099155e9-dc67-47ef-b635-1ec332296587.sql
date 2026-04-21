-- Add unique constraint for upsert
ALTER TABLE public.instagram_posts 
ADD CONSTRAINT instagram_posts_profile_instagram_unique UNIQUE (profile_id, instagram_id);

-- Fix post_type check to match values used by sync function
ALTER TABLE public.instagram_posts DROP CONSTRAINT instagram_posts_post_type_check;
ALTER TABLE public.instagram_posts 
ADD CONSTRAINT instagram_posts_post_type_check 
CHECK (post_type = ANY (ARRAY['reel'::text, 'reels'::text, 'carousel'::text, 'image'::text, 'static'::text, 'video'::text]));