

# Criar Edge Function "create-task" para o n8n

## Objetivo

Criar uma nova Edge Function que o n8n chamara logo apos o node "Cria Negocio", usando os dados retornados (deal.id, lead_id) para criar a tarefa "Primeiro Contato Realizado" atribuida ao Jonathan Marcato.

## Nova Edge Function

**Arquivo:** `supabase/functions/create-task/index.ts`

A funcao recebera um POST com os seguintes campos:
- `deal_id` (obrigatorio) - vindo do output do node anterior (`{{ $json.deal.id }}`)
- `lead_id` (opcional) - vindo do output (`{{ $json.deal.lead_id }}`)
- `title` - titulo da tarefa (ex: "Primeiro Contato Realizado")
- `activity_type_id` - ID do tipo de atividade
- `assigned_to` - ID do usuario responsavel
- `priority` - prioridade (default: "medium")
- `due_date` / `due_time` - agendamento (default: data/hora atual)

Usara a mesma autenticacao por API Key ja existente (`_shared/api-key-auth.ts`).

## Configuracao do node no n8n

O node "Cria Tarefa" devera ser configurado assim:

- **Method:** POST
- **URL:** `https://mtzoavnbtqflufyccern.supabase.co/functions/v1/create-task`
- **Authentication:** Header com `x-api-key` (mesma chave usada no create-deal)
- **Body (JSON):**

```text
{
  "deal_id": "{{ $json.deal.id }}",
  "lead_id": "{{ $json.deal.lead_id }}",
  "title": "Primeiro Contato Realizado",
  "activity_type_id": "ce57b13b-a359-46e5-b2b5-5160b2cd7dc1",
  "assigned_to": "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
  "priority": "medium"
}
```

O `due_date` e `due_time` serao preenchidos automaticamente com a data/hora atual se nao forem enviados.

## Detalhes tecnicos

A funcao:
1. Valida autenticacao via API Key
2. Valida campo obrigatorio `deal_id`
3. Insere na tabela `internal_tasks` com os campos: account_id, deal_id, lead_id, title, activity_type_id, assigned_to, created_by (mesmo que assigned_to), priority, status ("pending"), due_date, due_time
4. Retorna o ID da tarefa criada
5. Erros sao tratados sem bloquear o fluxo

Tambem sera necessario adicionar a configuracao `verify_jwt = false` no `supabase/config.toml` para a nova funcao.

