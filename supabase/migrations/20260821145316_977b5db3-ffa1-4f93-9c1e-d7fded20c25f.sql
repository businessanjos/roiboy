WITH norm AS (
  SELECT id,
    lower(translate(education, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS p
  FROM public.clients
  WHERE education IS NOT NULL AND education <> ''
), mapped AS (
  SELECT id, CASE
    WHEN p ~ 'veterinar' THEN 'Medicina Veterinária'
    WHEN p ~ 'medic' THEN 'Medicina'
    WHEN p ~ 'enferm' THEN 'Enfermagem'
    WHEN p ~ 'fisi(o|)terap|fisioterp' THEN 'Fisioterapia'
    WHEN p ~ 'biomedic|biometic|bio-medic' THEN 'Biomedicina'
    WHEN p ~ 'odonto|dentist|ondonto|oonto|osonto' THEN 'Odontologia'
    WHEN p ~ 'farmac|farmace' THEN 'Farmácia'
    WHEN p ~ 'nutri' THEN 'Nutrição'
    WHEN p ~ 'estetic|cosmetolog|cosmetic|micropigment|micropgment|podolog|cabeleire|sobrancelh' THEN 'Estética e Cosmética'
    WHEN p ~ 'psicolog' THEN 'Psicologia'
    WHEN p ~ 'educacao fisica|educador fisico' THEN 'Educação Física'
    WHEN p ~ 'fonoaudiol' THEN 'Fonoaudiologia'
    WHEN p ~ 'terap(euta|ia) ocupacional' THEN 'Terapia Ocupacional'
    WHEN p ~ 'administra' THEN 'Administração'
    WHEN p ~ 'direito|advog' THEN 'Direito'
    WHEN p ~ 'arquitet' THEN 'Arquitetura e Urbanismo'
    WHEN p ~ 'agronom' THEN 'Agronomia'
    WHEN p ~ 'contab' THEN 'Ciências Contábeis'
    WHEN p ~ 'engenh' THEN 'Engenharia de Produção'
    WHEN p ~ 'comunicacao|publicidade|marketing' THEN 'Marketing'
    WHEN p ~ 'radiolog' THEN 'Radiologia'
    WHEN p ~ 'quiroprax' THEN 'Quiropraxia'
    ELSE NULL
  END AS novo
  FROM norm
)
UPDATE public.clients c
SET education = m.novo
FROM mapped m
WHERE c.id = m.id AND m.novo IS NOT NULL AND c.education IS DISTINCT FROM m.novo;