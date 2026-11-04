-- Selos de etiqueta ao lado do nome no RoyZapp: entra no tempo real para
-- atualizar na hora, sem o usuario precisar recarregar a tela.
-- RLS ja ativa nas duas tabelas (zapp_conversation_tags 5 politicas, zapp_tags 7),
-- entao cada pessoa so recebe o que ja pode ler.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zapp_conversation_tags'
  ) then
    execute 'alter publication supabase_realtime add table public.zapp_conversation_tags';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zapp_tags'
  ) then
    execute 'alter publication supabase_realtime add table public.zapp_tags';
  end if;
end $$;
