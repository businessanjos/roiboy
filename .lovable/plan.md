

## Criar Edge Function para renomear arquivo do negócio

### Problema

A API REST do banco requer um JWT válido + a chave anon no header `apikey`. A chave `roy_sk_...` é reconhecida apenas pelas Edge Functions customizadas, por isso retorna "No API key found in request!".

### Solução

Criar uma Edge Function `update-deal-activity` que aceita a autenticação `roy_sk_` (igual aos outros endpoints) e atualiza o `file_name` da atividade.

### Edge Function: `supabase/functions/update-deal-activity/index.ts`

- **Método**: PATCH
- **Autenticação**: `x-api-key` ou `Authorization: Bearer roy_sk_...`
- **Body JSON**:
  - `activity_id` (UUID da atividade retornada pelo node anterior)
  - `file_name` (novo nome do arquivo)
- **Lógica**:
  1. Autentica via `authenticateRequestWithLegacy`
  2. Valida `activity_id` e `file_name`
  3. Atualiza o registro em `deal_activities` onde `id = activity_id` e `account_id` corresponde
  4. Retorna sucesso

### Configuração do config.toml

Adicionar entrada para a nova função com `verify_jwt = false`.

### Configuração no n8n (Atualiza Nome do Contrato Anexado)

- **Method**: `PATCH`
- **URL**: `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/update-deal-activity`
- **Headers**:
  - `x-api-key`: sua chave de API
- **Body Content Type**: `JSON`
- **JSON**:
```json
{
  "activity_id": "{{ $('Anexa Contrato no Negocio').item.json.activity_id }}",
  "file_name": "{{ $node['Webhook1'].json.body.signers[0].name + ' - ' + $node['Webhook1'].json.body.name + '.pdf' }}"
}
```
