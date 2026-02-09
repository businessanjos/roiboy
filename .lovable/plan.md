

# Criar Edge Function create-deal para cadastrar negocios via n8n

## Objetivo
Criar uma nova Edge Function que receba os dados do formulario (vindos do "Edit Fields5" no n8n) e cadastre um novo negocio (Deal) vinculado ao Lead recem-criado.

## Mapeamento de Campos

Com base nos dados visiveis no "Edit Fields5":

| Campo n8n (Edit Fields5) | Coluna deals | Observacao |
|---|---|---|
| finalDealTitle | title | Ex: "[TRAF-IMP-EC]" |
| finalPersonId | lead_id | UUID do lead criado no node anterior |
| leadName | contact_name | Nome do contato |
| leadPhoneNumber | contact_phone | Telefone |
| leadEmail | contact_email | Email |
| CanalDeVenda | source | Ex: "Trafego Pago" |
| ItemDaVenda | notes / product_id | Salvo em deal_field_values como "Item da Venda" |
| MaiorDificuldade | notes | Concatenado nas notas |
| FormTitle | tags | Como tag |
| MQL | tags | Como tag |

## Nova Edge Function

**Arquivo:** `supabase/functions/create-deal/index.ts`

### Endpoint
- **Method:** POST
- **URL:** `.../functions/v1/create-deal`
- **Autenticacao:** API Key (reutiliza `_shared/api-key-auth.ts`)

### Payload esperado
```json
{
  "title": "[TRAF-IMP-EC]",
  "lead_id": "07f1fd24-e260-4482-bcac-7999166a10d6",
  "contact_name": "Flavia Bianchi",
  "contact_phone": "+5511991689572",
  "contact_email": "flaviabianchinni@icloud.com",
  "source": "Trafego Pago",
  "tags": ["TRAF-IMP-EC", "NÃO - Abaixo de 30k"],
  "notes": "Item da Venda: Rykas Pass\nMaior Dificuldade: null",
  "product_id": "Rykas Pass"
}
```

### Logica
1. Autentica via API Key
2. Valida campo obrigatorio (`title`)
3. Valida UUID do `lead_id` (se fornecido)
4. Busca o primeiro stage (menor `display_order`) para atribuir automaticamente
5. Insere na tabela `deals` com `status = 'open'`
6. Se `product_id` fornecido, faz fuzzy match na tabela `products` e salva em `deal_field_values` (campo "Item da Venda")
7. Registra atividade em `deal_activities`
8. Retorna o deal criado

### Resposta de sucesso (201)
```json
{
  "success": true,
  "deal": {
    "id": "uuid",
    "title": "[TRAF-IMP-EC]",
    "lead_id": "uuid",
    "status": "open",
    "stage_id": "uuid"
  }
}
```

## Mudancas Tecnicas

1. **Criar** `supabase/functions/create-deal/index.ts` - Edge Function completa com autenticacao, fuzzy match de produto e auto-assign de stage
2. **Atualizar** `supabase/config.toml` - Adicionar `[functions.create-deal]` com `verify_jwt = false`

## Como usar no n8n

No node "Cria Negocio" (HTTP Request):
- **Method:** POST
- **URL:** `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/create-deal`
- **Send Headers:** ON, com `Authorization: Bearer roy_sk_...`
- **Send Body:** ON, tipo JSON:

```json
{
  "title": "{{ $json.finalDealTitle }}",
  "lead_id": "{{ $json.finalPersonId }}",
  "contact_name": "{{ $json.leadName }}",
  "contact_phone": "{{ $json.leadPhoneNumber }}",
  "contact_email": "{{ $json.leadEmail }}",
  "source": "{{ $json.CanalDeVenda }}",
  "tags": ["{{ $json.FormTitle }}", "{{ $json.MQL }}"],
  "notes": "Item da Venda: {{ $json.ItemDaVenda }}\nMaior Dificuldade: {{ $json.MaiorDificuldade }}",
  "product_id": "{{ $json.ItemDaVenda }}"
}
```

