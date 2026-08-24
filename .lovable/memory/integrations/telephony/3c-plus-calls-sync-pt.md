---
name: Sincronização de ligações 3C Plus
description: Import automático do histórico de ligações da 3C Plus por agente (token individual), exibido em Vendas > Gestão > Performance > Telefonia
type: feature
---

A API da 3C Plus só libera o relatório global `/api/v1/calls` para tokens de administrador. O token da conta (Jonathan Marcato, agente 56400) é de agente e recebe 403 em `/api/v1/calls`, `/api/v1/users`, `/api/v1/campaigns`.

Solução adotada: sincronizar **por agente** via `/api/v1/agent/calls` (datas obrigatórias no formato `Y-m-d H:i:s`, fuso de Brasília). Cada pessoa precisa ter o próprio token de API cadastrado.

- Tabela `threecplus_agents`: agente 3C (external_agent_id, nome, e-mail) + `api_token` (coluna sem SELECT para `authenticated`) + vínculo com `users.id`.
- Tabela `threecplus_sync_state`: lease (single-flight), pausa em 401/403, último sync.
- `threecplus_call_logs`: `user_id` agora é nullable, com `agent_external_id/agent_name/agent_email` e UNIQUE (account_id, call_id) para upsert idempotente.
- Edge functions: `threecplus-sync-calls` (cron horário `threecplus-sync-calls-hourly` autenticado pelo cofre `internal_cron_tokens`) e `threecplus-register-agent` (valida token via `/api/v1/me` e cadastra o agente).
- UI: `ThreeCPlusSyncPanel` dentro de `ThreeCPlusMetrics` (Vendas > Gestão > Performance > Telefonia).

Durações vêm como "HH:MM:SS" (`speaking_time`, `acw_time`, `waiting_time`); status via `readable_status_text`.

Modo administrador (opcional): salvando um token com perfil admin em `integrations.config.admin_api_token` (ação `set_admin_token` na edge function `threecplus-register-agent`, validada contra `/api/v1/calls`), a sync usa o relatório global e importa todas as ligações da conta de uma vez, ignorando os tokens por agente. Removendo o token, volta ao modo por agente.
