
## Criar Edge Function para anexar contrato ao historico do negocio

### O que sera feito

Criar uma nova Edge Function `attach-deal-file` que recebe um arquivo (contrato PDF) e o `deal_id` via **Form-Data**, faz upload no bucket `deal-activities` e insere uma entrada no historico de atividades do negocio.

### Edge Function: `supabase/functions/attach-deal-file/index.ts`

- **Metodo**: POST
- **Autenticacao**: API Key (mesma logica dos outros endpoints, via `x-api-key` ou `Authorization`)
- **Body**: Form-Data com:
  - `deal_id` (string, UUID do negocio)
  - `file` (binary, o arquivo PDF do contrato)
  - `title` (string, opcional - titulo da nota, default: "Contrato anexado")
- **Logica**:
  1. Autentica a requisicao
  2. Valida o `deal_id` e verifica que pertence a conta
  3. Faz upload do arquivo no bucket `deal-activities` no path `{account_id}/deals/{deal_id}/{uuid}.{ext}`
  4. Obtem a URL publica do arquivo
  5. Insere registro em `deal_activities` com `type: "file"`, `file_url`, `file_name`, `file_size`
  6. Retorna sucesso com o `activity_id`

### Configuracao no n8n (HTTP Request)

Apos criada a funcao, configure o node "Anexa Contrato no Negocio" assim:

- **Method**: `POST`
- **URL**: `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/attach-deal-file`
- **Authentication**: None (usar header customizado)
- **Send Headers**: Ativado
  - `x-api-key`: sua chave de API
- **Send Body**: Ativado
- **Body Content Type**: `Form-Data`
- **Body Fields**:
  1. **Name**: `deal_id` | **Type**: Form Data | **Value**: `{{ $('Filtra os Negócios').item.json.id }}`
  2. **Name**: `file` | **Type**: n8n Binary File | **Input Data Field Name**: `data`
  3. **Name**: `title` | **Type**: Form Data | **Value**: `Contrato assinado` (opcional)
