-- Create composition_templates table for system-defined templates
CREATE TABLE public.composition_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  composition_items TEXT[] NOT NULL,
  post_type TEXT, -- 'reels', 'carousel', 'static' or NULL for all
  objective TEXT, -- 'growth', 'connection', 'authority', 'sales' or NULL
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create composition_presets table for user favorites
CREATE TABLE public.composition_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  composition_items TEXT[] NOT NULL,
  specialist_version TEXT,
  post_type TEXT,
  objective TEXT,
  is_favorite BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, name)
);

-- Enable RLS on composition_presets
ALTER TABLE public.composition_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for composition_presets
CREATE POLICY "Users can view presets from their account"
ON public.composition_presets FOR SELECT
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can create presets for their account"
ON public.composition_presets FOR INSERT
WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update presets from their account"
ON public.composition_presets FOR UPDATE
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can delete presets from their account"
ON public.composition_presets FOR DELETE
USING (account_id = public.get_my_account_id());

-- Seed data for system templates
INSERT INTO public.composition_templates (name, description, icon, composition_items, post_type, objective) VALUES
('Reels Viral', 'Combinação otimizada para viralização de Reels', 'Zap', 
  ARRAY['Musica em alta', 'Gancho forte', 'Duração: até 30 segundos', 'Trendy e fixado', 'Capa chamativa'], 
  'reels', 'growth'),
  
('Carrossel Reflexivo', 'Carrossel para conexão e engajamento profundo', 'Heart', 
  ARRAY['8 a 12 telas', 'Legenda reflexiva e maior', 'Legenda contextualizada', 'Fotos orgânicas', 'Valores'], 
  'carousel', 'connection'),
  
('Post de Autoridade', 'Conteúdo para posicionamento de autoridade', 'Crown', 
  ARRAY['Headline branca com borda preta legível', 'Legenda nível de consciência', 'Texto sobre imagem'], 
  'static', 'authority'),
  
('Trends do Momento', 'Aproveitar trends atuais para crescimento', 'TrendingUp', 
  ARRAY['Musica em alta', 'Trendy e fixado', 'Rostos conhecidos', 'Pessoas famosas para o público'], 
  'reels', 'growth'),
  
('Carrossel de Vendas', 'Carrossel focado em conversão', 'ShoppingCart', 
  ARRAY['CTA clique no link', 'CTA + imagens do método', 'Tela antes e depois comparativo', 'Prova social'], 
  'carousel', 'sales'),
  
('Dump Lifestyle', 'Conteúdo lifestyle para conexão', 'Camera', 
  ARRAY['Fotos orgânicas', 'Família', 'Conquista', 'Vida ryka', 'Valoriza a mulher'], 
  'static', 'connection'),
  
('Reels Casal', 'Reels com conteúdo de casal', 'Users', 
  ARRAY['Reels curto/trendy casal até 30s', 'Versão marido', 'Imagens são orgânicas', 'Musica em alta'], 
  'reels', 'connection'),
  
('Conteúdo Educativo', 'Posts educativos para autoridade', 'BookOpen', 
  ARRAY['Legenda nível de consciência', 'Legenda contextualizada', 'CTA engajamento', 'Headline clara'], 
  'carousel', 'authority'),
  
('Stories Highlights', 'Conteúdo para stories e destaques', 'Star', 
  ARRAY['Capa chamativa', 'CTA swipe up', 'Duração: até 15 segundos', 'Texto curto e direto'], 
  'reels', 'growth');