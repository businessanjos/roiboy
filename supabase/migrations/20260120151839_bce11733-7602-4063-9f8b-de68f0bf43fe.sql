-- Adicionar coluna notes para observações nos vídeos do TikTok
ALTER TABLE public.tiktok_posts 
ADD COLUMN notes TEXT;