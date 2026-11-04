-- Cadastros de cliente que são a própria equipe: o telefone (principal ou um dos
-- extras) bate com um número interno — registrado em zapp_internal_contacts ou
-- telefone de colaborador em hr_collaborators — comparado pelo mesmo código do
-- RPC zapp_productivity_metrics (DDD + últimos 8 dígitos).
--
-- Read-only: nenhum registro muda. Serve para as telas e contagens pararem de
-- apresentar essas pessoas como clientes.
create or replace function public.internal_client_ids(p_account_id uuid)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  with internal_cores as (
    select distinct core
    from (
      select public.zapp_phone_core(phone_e164) as core
      from public.zapp_internal_contacts
      where account_id = p_account_id
      union all
      select public.zapp_phone_core(phone) as core
      from public.hr_collaborators
      where account_id = p_account_id
        and phone is not null
        and phone <> ''
    ) t
    where core is not null and core <> ''
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
  )
  select distinct cc.client_id
  from client_cores cc
  join internal_cores ic on ic.core = cc.core
  where cc.core is not null and cc.core <> '';
$$;

grant execute on function public.internal_client_ids(uuid) to authenticated, service_role;