INSERT INTO instagram_post_options (account_id, option_type, value, display_order, is_system_default)
SELECT 
  account_id,
  'composition',
  option_value,
  option_order,
  true
FROM (
  SELECT DISTINCT account_id FROM instagram_post_options
) accounts
CROSS JOIN (
  VALUES 
    ('Valoriza a mulher', 0),
    ('Autoral (medo, riqueza, bmw)', 1),
    ('Mentalidade firme', 2),
    ('Ação', 3),
    ('Reels curto/trendy casal até 30s', 4),
    ('Versão marido', 5),
    ('Musica em alta', 6),
    ('Imagens são orgânicas', 7),
    ('Um take só sem edição', 8),
    ('Headline branca com borda preta legível', 9),
    ('Ganho forte de conexão', 10),
    ('Legenda reflexiva e maior', 11),
    ('Videos vitalizados', 12),
    ('Ideia de conteúdo', 13),
    ('Tela verde', 14),
    ('Jeito certo', 15),
    ('Legenda nível de consciência', 16),
    ('Duração: até 30 segundos', 17),
    ('Rostos conhecidos', 18),
    ('8 a 12 telas', 19),
    ('Legenda: média', 20),
    ('Despertou uma emoção', 21),
    ('Valores', 22),
    ('Família', 23),
    ('Fotos orgânicas', 24),
    ('Conquista', 25),
    ('Vida ryka', 26),
    ('Trendy e fixado', 27),
    ('Gancho forte', 28),
    ('Fonte stories', 29),
    ('Capa com expressão/imagem chamativa', 30),
    ('CTA clique no link', 31),
    ('Pessoas famosas para o público', 32),
    ('Padrão de gancho e estética', 33),
    ('Capa chamativa e bonita', 34),
    ('Capa elementos que comuniquem conteúdo', 35),
    ('2a tela contextualiza acontecimento', 36),
    ('Alterna com vídeos (1a tela e outras)', 37),
    ('Legenda contextualizada', 38),
    ('Conteúdo linkado com estética', 39),
    ('Tela antes e depois comparativo', 40),
    ('CTA + imagens do método', 41),
    ('Postado até a 1a semana', 42)
) AS defaults(option_value, option_order)
WHERE NOT EXISTS (
  SELECT 1 FROM instagram_post_options 
  WHERE instagram_post_options.account_id = accounts.account_id 
    AND instagram_post_options.value = defaults.option_value 
    AND instagram_post_options.option_type = 'composition'
);