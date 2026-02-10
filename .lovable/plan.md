

## Criar Edge Function `get-lead-latest-deal`

Uma nova backend function que retorna **apenas o negócio mais recente** vinculado a um lead, independente do status.

### URL para o n8n

```
GET https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-latest-deal?lead_id={{ $json.lead.id }}
```

### Configuracao no n8n

| Campo | Valor |
|-------|-------|
| Method | GET |
| URL | `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-latest-deal` |
| Send Query Parameters | ON |
| Parameter: `lead_id` | `{{ $json.lead.id }}` |
| Headers: Authorization | `Bearer roy_sk_...` (mesma chave) |

### Resposta esperada

```json
{
  "found": true,
  "deal": {
    "id": "uuid",
    "title": "...",
    "value": 1500,
    "currency": "BRL",
    "status": "open",
    "stage_name": "Qualificacao",
    "responsible_user_name": "Jonathan",
    "created_at": "2026-02-10T..."
  }
}
```

### Implementacao tecnica

- Arquivo: `supabase/functions/get-lead-latest-deal/index.ts`
- Reutiliza o padrao de autenticacao existente (`authenticateRequestWithLegacy` de `_shared/api-key-auth.ts`)
- Query: `deals` filtrado por `lead_id` e `account_id`, ordenado por `created_at DESC`, `limit(1)`
- Inclui joins para `deal_stages.name` e `users.name` (responsavel)
- Validacao UUID no `lead_id`
- Registrar `config.toml` com `verify_jwt = false`

