-- Divide os cadastros "não são clientes" em dois grupos, para a tela poder
-- esconder uns e marcar outros como Interno sem mexer em nenhum registro.
--
--   all    = telefone bate com número interno OU com telefone de colaborador
--            (não é cliente: fora de contagens, métricas e etiquetas de cliente)
--   hidden = bate com número registrado em zapp_internal_contacts
--            (some da lista de clientes)
--
-- O que sobra em all e não está em hidden aparece na lista marcado "Interno".
-- Read-only: nenhum registro muda.
create or replace function public.internal_client_split(p_account_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with registered_cores as (
    select distinct public.zapp_phone_core(phone_e164) as core
    from public.zapp_internal_contacts
    where account_id = p_account_id
  ),
  collab_cores as (
    select distinct public.zapp_phone_core(phone) as core
    from public.hr_collaborators
    where account_id = p_account_id
      and phone is not null
      and phone <> ''
  ),
  client_cores as (
    select c.id as client_id, public.zapp_phone_core(c.phone_e164) as core
    from public.clients c
    where c.account_id = p_account_id
      and c.phone_e164 is not null
      and c.phone_e164 <> ''
    union all
    select c.id, public.zapp_phone_core(e.value #>> '{}')
    from public.clients c
    cross join lateral jsonb_array_elements(c.additional_phones) as e(value)
    where c.account_id = p_account_id
      and jsonb_typeof(c.additional_phones) = 'array'
      and jsonb_typeof(e.value) = 'string'
  ),
  matched as (
    select cc.client_id,
           bool_or(cc.core in (select core from registered_cores)) as is_registered,
           bool_or(cc.core in (select core from collab_cores)) as is_collaborator
    from client_cores cc
    where cc.core is not null and cc.core <> ''
    group by cc.client_id
  ),
  flagged as (
    select client_id,
           (is_registered or is_collaborator) as is_internal,
           is_registered as is_hidden
    from matched
  )
  select jsonb_build_object(
    'all', coalesce((select jsonb_agg(client_id) from flagged where is_internal), '[]'::jsonb),
    'hidden', coalesce((select jsonb_agg(client_id) from flagged where is_hidden), '[]'::jsonb)
  );
$$;

grant execute on function public.internal_client_split(uuid) to authenticated, service_role;
