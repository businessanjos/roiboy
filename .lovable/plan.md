
# Criar Edge Function get-lead-won-deals

## Objetivo
Criar uma nova Edge Function que receba o `lead_id` e retorne todos os negocios com status "won" vinculados a esse lead.

## Estrutura do Banco
A tabela `deals` possui a coluna `lead_id` (UUID) que vincula negocios a leads, e a coluna `status` que indica o estado (won/lost/open).

## Nova Edge Function

**Arquivo:** `supabase/functions/get-lead-won-deals/index.ts`

### Endpoint
- **Method:** GET
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-won-deals?lead_id={LEAD_ID}`
- **Autenticacao:** mesma logica de API Key/JWT (reutiliza `_shared/api-key-auth.ts`)

### Parametro
- `lead_id` (obrigatorio) - UUID do lead

### Query no banco
```sql
SELECT id, title, value, currency, status, won_at, source, contact_name, 
       contact_phone, responsible_user_id, created_at, tags
FROM deals
WHERE lead_id = :lead_id 
  AND account_id = :account_id 
  AND status = 'won'
ORDER BY won_at DESC
```
- Faz join com `users` para trazer o nome do responsavel

### Resposta

Negocios ganhos encontrados:
```json
{
  "found": true,
  "count": 1,
  "deals": [
    {
      "id": "uuid",
      "title": "Mentoria Premium",
      "value": 5000,
      "currency": "BRL",
      "status": "won",
      "won_at": "2026-01-15T10:00:00Z",
      "source": "indicacao",
      "contact_name": "Tatiane Ferreira",
      "contact_phone": "+5561998662638",
      "responsible_user_name": "Joao Ferrari",
      "created_at": "...",
      "tags": []
    }
  ]
}
```

Nenhum negocio ganho:
```json
{
  "found": false,
  "count": 0,
  "deals": []
}
```

## Mudancas

1. **Criar** `supabase/functions/get-lead-won-deals/index.ts` - Edge Function completa com autenticacao, validacao de UUID e query
2. **Atualizar** `supabase/config.toml` - Adicionar `[functions.get-lead-won-deals]` com `verify_jwt = false`

## Como usar no n8n

No node "Search Won Deals" (HTTP Request):
- **Method:** GET
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-lead-won-deals?lead_id={{ $json.lead.id }}`
- **Headers:** `Authorization: Bearer roy_sk_...`

Substitui a URL atual do Pipedrive pela nossa Edge Function, buscando diretamente no banco de dados do ROY.
