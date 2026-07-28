UPDATE public.practice_areas SET label = 'Micro/Nano pigmentação' WHERE slug = 'micropigmentacao';

INSERT INTO public.practice_areas (label, slug, sort_order, active) VALUES
('Harmonização','harmonizacao',130,true),
('Melasma','melasma',140,true),
('Acne','acne',150,true),
('Orelha','orelha',160,true),
('Nariz','nariz',170,true),
('Gordura Localizada','gordura-localizada',180,true),
('Flacidez','flacidez',190,true),
('Estrias','estrias',200,true),
('Depilação a Laser','depilacao-a-laser',210,true),
('Pós operatório','pos-operatorio',220,true),
('Dentista','dentista',230,true),
('Bronzeamento','bronzeamento',240,true),
('Unha','unha',250,true),
('Salão de beleza','salao-de-beleza',260,true),
('Bumbum','bumbum',270,true),
('Vazinhos','vazinhos',280,true)
ON CONFLICT (slug) DO NOTHING;