

## Corrigir erro persistente na criacao de OS no Omie

### Diagnostico

Apos investigacao profunda, identifiquei **tres problemas** na Edge Function `create-omie-os`:

1. **`nCodCC: 0` invalido** - A documentacao oficial do Omie mostra que `nCodCC` deve ser um codigo de conta corrente real (ex: `11850365`). Enviar `0` pode causar a rejeicao do bloco inteiro de `InformacoesAdicionais`, fazendo com que o Omie ignore o `cCodCateg` mesmo estando presente no payload.

2. **Logs de erro quebrados** - O `req.clone().json()` no bloco catch falha silenciosamente, pois o body do request ja foi consumido. Por isso a tabela `omie_integration_logs` esta vazia (0 registros), impossibilitando o debug pelo usuario.

3. **Falta de log do payload** - Nao ha `console.log` do payload antes de enviar para a API, dificultando o debug nos logs da funcao.

### Alteracoes

**Arquivo: `supabase/functions/create-omie-os/index.ts`**

1. **Salvar o body do request no inicio** para uso posterior no catch:
   - Extrair `deal_id` e `account_id` em variavel antes do try/catch

2. **Remover `nCodCC: 0`** do payload `InformacoesAdicionais`:
   - O campo so deve ser enviado se o usuario configurar um codigo de conta corrente real
   - Sem ele, o Omie usa a conta padrao

3. **Adicionar console.log do payload** antes de chamar a API:
   - `console.log('OS Payload:', JSON.stringify(osPayload))`

4. **Corrigir o logging de erro** no catch:
   - Usar as variaveis `deal_id` e `account_id` salvas antes do try, em vez de tentar re-ler o body do request

### Resultado esperado

- O `cCodCateg` sera reconhecido pela API do Omie sem interferencia do `nCodCC` invalido
- Os logs de integracao serao registrados corretamente na tabela para debug futuro
- O payload exato sera visivel nos logs da funcao para qualquer depuracao

