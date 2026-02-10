

## Criar Edge Function `update-deal-notes`

Uma nova backend function para **inserir/atualizar as observações (notes)** de um negócio existente, permitindo que o n8n envie as anotações formatadas do Typeform diretamente para o deal encontrado no node anterior.

### URL para o n8n

```
PATCH https://mtzoavtbtqflufyccern.supabase.co/functions/v1/update-deal-notes
```

### Configuracao no n8n

| Campo | Valor |
|-------|-------|
| **Method** | `PATCH` |
| **URL** | `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/update-deal-notes` |
| **Authentication** | Predefined Credential (Header Auth com `Authorization: Bearer roy_sk_...`) |
| **Send Body** | ON (JSON) |
| **Body** | `{ "deal_id": "{{ $('Procura negocio mais recente do lead').item.json.deal.id }}", "notes": "{{ $('Formata a anotacao').item.json.anotações }}" }` |

O campo `notes` recebera o texto formatado vindo do node "Formata a anotacao" (pergunta: resposta, linha a linha).

### Comportamento

- Se o deal ja possui observacoes, as anotacoes do Typeform serao **concatenadas** ao conteudo existente (com separador e timestamp).
- Se o deal nao tem observacoes, o campo sera preenchido com as anotacoes do formulario.
- Retorna o deal atualizado com confirmacao.

### Resposta esperada

```json
{
  "success": true,
  "deal_id": "uuid",
  "notes": "conteudo atualizado..."
}
```

### Detalhes tecnicos

**Novo arquivo:** `supabase/functions/update-deal-notes/index.ts`

- **Metodo:** PATCH
- **Autenticacao:** `authenticateRequestWithLegacy` (mesma das demais functions)
- **Payload:** `{ deal_id: string, notes: string, append?: boolean }`
  - `append` default `true` -- concatena ao existente
- **Logica:**
  1. Valida UUID do `deal_id`
  2. Busca deal existente (`notes` atuais) filtrando por `account_id`
  3. Se `append=true`, concatena: `notas_existentes + separador + novas_notas`
  4. Atualiza o campo `notes` do deal
  5. Registra uso da API key
- **Config:** Adicionar `[functions.update-deal-notes]` com `verify_jwt = false` no `supabase/config.toml`

