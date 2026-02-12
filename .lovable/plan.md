

## Corrigir status de entrega (checks) e configuracao automatica de webhook

### Problema identificado

Duas falhas combinadas impedem os checks de funcionar:

1. **Evento `messages.update` nao habilitado no UAZAPI**: O webhook do UAZAPI precisa escutar o evento `messages.update` para receber atualizacoes de status (sent/delivered/read). Atualmente, so `messages` esta habilitado.

2. **Acao `configure_webhook` inexistente**: O frontend chama `uazapi-manager` com `action: "configure_webhook"`, mas essa acao nao esta implementada no edge function. Isso significa que o botao "Configurar Webhook" nao faz nada.

### Solucao

**Arquivo: `supabase/functions/uazapi-manager/index.ts`**

Adicionar a acao `configure_webhook` que configura automaticamente o webhook do UAZAPI com **todos os eventos necessarios**, incluindo `messages.update`:

- Usa o endpoint da API UAZAPI para configurar o webhook URL apontando para `uazapi-webhook`
- Habilita os eventos: `messages`, `messages.update`, `connection`, `groups`, `qrcode`
- Atualiza o campo `webhook_configured` na integracao

### Acao imediata do usuario

Enquanto o codigo e atualizado, voce pode resolver manualmente adicionando o evento **`messages.update`** na configuracao de webhook do UAZAPI. Este e o evento que carrega os dados de ACK (sent=2, delivered=3, read=4).

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar handler para `action: "configure_webhook"` usando a API UAZAPI para configurar webhook com eventos corretos |

### O que muda para o usuario

- Os checks das mensagens enviadas serao atualizados corretamente: relogio (pendente) -> 1 check (enviado) -> 2 checks (entregue) -> 2 checks azuis (lido)
- O botao "Configurar Webhook" na tela de integracoes passara a funcionar
- Novas instancias terao o webhook configurado automaticamente com todos os eventos necessarios

