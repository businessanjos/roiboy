

## Salvar link do contrato no campo personalizado

### O que sera feito

Estender a Edge Function `update-deal-activity` para aceitar campos opcionais `deal_id` e `contract_url`. Quando presentes, a funcao fara um upsert na tabela `deal_field_values` para o campo "Link do contrato/invoice" (ID: `9b9acf49-d403-40ca-aea5-ff00d8c6f905`).

Isso permite que o mesmo endpoint que renomeia o arquivo tambem salve o link no campo personalizado, ou que um node separado faca apenas o salvamento do link.

### Alteracao

**Arquivo**: `supabase/functions/update-deal-activity/index.ts`

- Aceitar campos opcionais no body: `deal_id` (UUID) e `contract_url` (string)
- Se `deal_id` e `contract_url` estiverem presentes, fazer upsert em `deal_field_values`:
  - `deal_id`: o ID do negocio
  - `field_id`: `9b9acf49-d403-40ca-aea5-ff00d8c6f905`
  - `account_id`: da autenticacao
  - `value_text`: a URL do contrato
- Os campos `activity_id`/`file_name` passam a ser opcionais (pode fazer so rename, so link, ou ambos)
- Retornar o resultado incluindo `contract_url_saved: true` quando aplicavel

### Configuracao no n8n (Insere o Link do Contrato no Campo Personalizado)

- **Method**: `PATCH`
- **URL**: `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/update-deal-activity`
- **Headers**:
  - `x-api-key`: sua chave de API
- **Body Content Type**: `JSON`
- **JSON**:

```text
{
  "deal_id": "{{ $('Filtra os Negócios').item.json.id }}",
  "contract_url": "{{ $('Anexa Contrato no Negocio').item.json.file_url }}"
}
```

Nota: `file_url` e retornado pela funcao `attach-deal-file` e contem a URL publica do arquivo anexado. Se o campo tiver outro nome no output do node, ajuste conforme necessario.
