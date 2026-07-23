
CREATE TABLE public.practice_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.practice_areas TO authenticated;
GRANT ALL ON public.practice_areas TO service_role;

ALTER TABLE public.practice_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read practice areas"
  ON public.practice_areas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins manage practice areas"
  ON public.practice_areas FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_practice_areas_updated_at
  BEFORE UPDATE ON public.practice_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.practice_areas (label, slug, sort_order) VALUES
  ('Botox', 'botox', 10),
  ('Capilar', 'capilar', 20),
  ('Cílios', 'cilios', 30),
  ('Corporal', 'corporal', 40),
  ('Emagrecimento', 'emagrecimento', 50),
  ('Estética Íntima', 'estetica-intima', 60),
  ('Facial', 'facial', 70),
  ('Injetáveis', 'injetaveis', 80),
  ('Laser', 'laser', 90),
  ('Micropigmentação', 'micropigmentacao', 100),
  ('Remoção a laser', 'remocao-a-laser', 110),
  ('Sobrancelhas', 'sobrancelhas', 120);
