DELETE FROM public.content_pieces 
WHERE pillar_id IN (
  SELECT id FROM public.content_pillars 
  WHERE name IN (
    'Educação em Estética','Procedimentos & Resultados','Procedimentos Masculinos',
    'Bastidores & Rotina Clínica','Cases & Depoimentos','Lifestyle & Autoestima',
    'Lifestyle Empreendedor','Mentoria Eternum & Bastidores','Mercado & Tendências',
    'Gestão de Clínica de Estética'
  )
);
DELETE FROM public.content_pillars 
WHERE name IN (
  'Educação em Estética','Procedimentos & Resultados','Procedimentos Masculinos',
  'Bastidores & Rotina Clínica','Cases & Depoimentos','Lifestyle & Autoestima',
  'Lifestyle Empreendedor','Mentoria Eternum & Bastidores','Mercado & Tendências',
  'Gestão de Clínica de Estética'
);