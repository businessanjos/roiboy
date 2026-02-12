

## Corrigir recebimento de mensagens no ROY zAPP

### Causa raiz

O webhook de recebimento de mensagens (`uazapi-webhook`) possui uma trava de seguranca (kill switch) ativa na linha 198 do arquivo:

```
const FUNCTION_DISABLED = true;
```

Quando ativada, a funcao retorna status 200 imediatamente sem processar nenhuma mensagem recebida. Por isso:
- Envio funciona (usa o `uazapi-manager`, funcao separada)
- Recebimento nao funciona (depende do webhook que esta desligado)

### Correcao

Alterar uma unica linha no arquivo `supabase/functions/uazapi-webhook/index.ts`:

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Alterar `FUNCTION_DISABLED = true` para `FUNCTION_DISABLED = false` na linha 198 |

Apos essa mudanca, o webhook voltara a processar mensagens recebidas normalmente, inserindo-as na tabela `zapp_messages` e atualizando a conversa em tempo real.

### Risco

Esta flag foi ativada intencionalmente para reduzir consumo de recursos e custos. Reativa-la significa que o webhook voltara a consumir recursos do Cloud a cada mensagem recebida via WhatsApp. Se isso for aceitavel, a correcao e imediata.

