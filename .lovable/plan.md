
# Criar Edge Function get-lead-tasks para buscar tarefas de um Lead

## Objetivo
Criar uma nova Edge Function que receba o `lead_id` (retornado pelo node anterior) e retorne todas as tarefas (`internal_tasks`) vinculadas a esse lead.

## Nova Edge Function

**Arquivo:** `supabase/functions/get-lead-tasks/index.ts`

### Endpoint
- **Method:** GET
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-tasks?lead_id={LEAD_ID}`
- **Autenticacao:** mesma logica de API Key/JWT usada em `get-client-by-phone`

### Parametro
- `lead_id` (obrigatorio) - UUID do lead retornado pelo node anterior (ex: `ee3334d4-75ae-4635-83c5-ca5f3fbc988f`)

### Resposta

```json
{
  "found": true,
  "count": 2,
  "tasks": [
    {
      "id": "uuid",
      "title": "Follow Up",
      "description": "...",
      "status": "pending",
      "priority": "medium",
      "due_date": "2026-01-20",
      "due_time": "14:00",
      "assigned_to": "uuid",
      "assigned_user_name": "Joao Ferrari",
      "created_at": "...",
      "completed_at": null,
      "meeting_url": null,
      "meeting_platform": null
    }
  ]
}
```

Quando nao houver tarefas:
```json
{
  "found": false,
  "count": 0,
  "tasks": []
}
```

### Implementacao
- Reutiliza o modulo `_shared/api-key-auth.ts` para autenticacao
- Valida que `lead_id` e um UUID valido
- Busca em `internal_tasks` WHERE `lead_id = :lead_id` AND `account_id = :account_id`
- Faz join com `users` para trazer o nome do responsavel (`assigned_to`)
- Ordena por `due_date` ascendente (tarefas mais proximas primeiro)

## Como usar no n8n

No node HTTP Request:
- **Method:** GET  
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-tasks?lead_id={{ $json.lead.id }}`
- **Headers:** `Authorization: Bearer roy_sk_...`

O `$json.lead.id` vem do output do node "Verifica se ja esta cadastrado" (que retorna o lead com seu `id`).
