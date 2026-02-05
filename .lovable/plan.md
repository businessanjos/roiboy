

# Diagnóstico: WhatsApp Desconectado do ROY

## Problema Identificado

Todas as instâncias WhatsApp aparecem como "Sem instâncias" na seção "WhatsApp por Setor", mas a seção "Status das Conexões" mostra 4 instâncias conectadas. O erro exibido é: **"Failed to send a request to the Edge Function"**.

---

## Causa Raiz Confirmada

A **edge function `uazapi-manager` não está deployada** no ambiente de produção do Supabase.

### Evidências:

| Teste | Resultado |
|-------|-----------|
| Chamada para `uazapi-manager` | **404 - Function not found** |
| Chamada para `uazapi-webhook` | **200 - OK** (funcionando normalmente) |
| Logs de erro recentes | Múltiplas chamadas 404 para `uazapi-manager` |
| Banco de dados | As 4 integrações WhatsApp existem com `sector_id` correto |

### Logs de Erro no Sistema:

```
OPTIONS | 404 | /functions/v1/uazapi-manager   (múltiplas vezes)
OPTIONS | 404 | /functions/v1/list-clients     (múltiplas vezes)
OPTIONS | 404 | /functions/v1/process-ai-queue
```

---

## Por Que as Instâncias Aparecem "Conectadas" na Segunda Seção?

A seção "Status das Conexões" (WhatsAppIntegrationCard) busca dados diretamente da tabela `integrations` no banco de dados, **não da edge function**. Por isso mostra as 4 instâncias como "Conectado".

Já a seção "WhatsApp por Setor" (WhatsAppSectorManager) chama a edge function `uazapi-manager` com a ação `list_sector_instances`. Como a função retorna 404, a lista fica vazia.

---

## Por Que Isso Aconteceu?

As edge functions precisam ser **deployadas** para o ambiente de produção do Supabase. Possíveis causas:

1. **Deploy não foi executado** após alguma alteração recente
2. **Erro no deploy** que silenciosamente falhou
3. **Limite de funções** atingido no plano do Supabase (pouco provável)

---

## Solução

### Ação Imediata: Redeploy das Edge Functions

Executar o deploy das edge functions que estão faltando:

1. `uazapi-manager` - Gerenciamento de instâncias WhatsApp
2. `list-clients` - Listagem de clientes
3. `process-ai-queue` - Processamento de IA

**O deploy será feito automaticamente quando você aprovar este plano.**

---

## Funções que Precisam Deploy

| Função | Status Atual | Impacto |
|--------|--------------|---------|
| `uazapi-manager` | 404 - Não encontrada | Gerenciamento de instâncias quebrado |
| `list-clients` | 404 - Não encontrada | Listagem de clientes não funciona |
| `process-ai-queue` | 404 - Não encontrada | Processamento de IA parado |

---

## Ação Técnica

Ao aprovar este plano, as seguintes edge functions serão deployadas:

- `uazapi-manager`
- `list-clients`  
- `process-ai-queue`

---

## Resultado Esperado

Após o deploy:

1. A seção "WhatsApp por Setor" mostrará as 4 instâncias corretamente distribuídas
2. O botão "Verificar Status" funcionará sem erros
3. Todas as operações de gerenciamento de WhatsApp voltarão a funcionar

