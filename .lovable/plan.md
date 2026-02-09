

# Criar Edge Function create-lead para cadastrar novos Leads

## Objetivo
Criar uma nova Edge Function que receba os dados do formulario (vindos do node "Edit Fields" no n8n) e cadastre um novo lead na tabela `leads` do ROY.

## Mapeamento de Campos

Os campos do node "Edit Fields" serao mapeados para a tabela `leads` da seguinte forma:

| Campo n8n (Edit Fields) | Coluna leads | Tipo |
|---|---|---|
| leadName | full_name | text (obrigatorio) |
| leadPhoneNumber | phone | text |
| leadEmail | email | text |
| leadInstagram | instagram | text |
| CanalDeVenda | source | text |
| FaturamentoTexto | revenue_range | text |
| FormTitle | tags (como tag) | jsonb |
| OrigemDaVenda | tags (como tag) | jsonb |
| ItemDaVenda | notes (ou campo custom) | text |
| MQL | tags (como tag) | jsonb |
| MaiorDificuldade | notes | text |
| DataPrimeiroContato | created_at (override) | timestamp |

## Nova Edge Function

**Arquivo:** `supabase/functions/create-lead/index.ts`

### Endpoint
- **Method:** POST
- **URL:** `.../functions/v1/create-lead`
- **Autenticacao:** mesma logica de API Key (reutiliza `_shared/api-key-auth.ts`)

### Payload esperado (JSON body)
```json
{
  "full_name": "Flavia Bianchi",
  "phone": "+5511988214221",
  "email": "flaviabianchinni@icloud.com",
  "instagram": "@mdcclinnic",
  "source": "Trafego Pago",
  "revenue_range": "Abaixo de 20 mil reais",
  "tags": ["TRAF-IMP-EC", "NÃO - Abaixo de 30k"],
  "notes": "Item da Venda: Rykas Pass"
}
```

### Logica
1. Autentica via API Key
2. Valida campo obrigatorio (`full_name`)
3. Verifica duplicata por telefone (se fornecido) na tabela `leads` do mesmo account
4. Insere na tabela `leads` com `status = 'new'`
5. Retorna o lead criado

### Resposta de sucesso (201)
```json
{
  "success": true,
  "lead": {
    "id": "uuid",
    "full_name": "Flavia Bianchi",
    "phone": "+5511988214221",
    "status": "new"
  }
}
```

### Resposta de duplicata (409)
```json
{
  "error": "Lead already exists",
  "existing_lead": {
    "id": "uuid",
    "full_name": "Flavia Bianchi"
  }
}
```

## Mudancas Tecnicas

1. **Criar** `supabase/functions/create-lead/index.ts` - Edge Function completa
2. **Atualizar** `supabase/config.toml` - Adicionar `[functions.create-lead]` com `verify_jwt = false`

## Como usar no n8n

No node HTTP Request para cadastrar lead:
- **Method:** POST
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/create-lead`
- **Headers:** `Authorization: Bearer roy_sk_...`
- **Body (JSON):**
```json
{
  "full_name": "{{ $json.leadName }}",
  "phone": "{{ $json.leadPhoneNumber }}",
  "email": "{{ $json.leadEmail }}",
  "instagram": "{{ $json.leadInstagram }}",
  "source": "{{ $json.CanalDeVenda }}",
  "revenue_range": "{{ $json.FaturamentoTexto }}",
  "tags": ["{{ $json.FormTitle }}", "{{ $json.MQL }}"],
  "notes": "Item da Venda: {{ $json.ItemDaVenda }}\nMaior Dificuldade: {{ $json.MaiorDificuldade }}"
}
```

