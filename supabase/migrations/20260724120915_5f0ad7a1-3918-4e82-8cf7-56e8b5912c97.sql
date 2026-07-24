insert into public.sector_settings (account_id, sector_id, royzapp_host, royzapp_admin_token_secret_name)
values ('796e7970-fd93-4574-a871-6090624cace6', 'vendas', 'https://cs-roy-eternum.uazapi.com', 'UAZAPI_OPERACOES_ADMIN_TOKEN')
on conflict (account_id, sector_id) do update
  set royzapp_host = excluded.royzapp_host,
      royzapp_admin_token_secret_name = excluded.royzapp_admin_token_secret_name;