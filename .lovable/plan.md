

## Duas alteracoes no painel Conversas/WhatsApp

### 1. Adicionar rotulos de totais nas barras do "Leads Novos por Dia"

Adicionar um label no topo de cada barra empilhada mostrando o total de leads daquele dia.

**Arquivo:** `src/components/insights/whatsapp-dashboard/LeadsByDayChart.tsx`

- Adicionar o campo `_total` ao `chartData` calculando a soma de todos os sources para cada dia
- Importar `LabelList` do recharts
- Na ultima `Bar` renderizada (a do topo da pilha), adicionar um `<LabelList>` com `dataKey="_total"` posicionado acima da barra
- Estilizar com fonte pequena (fontSize 10), cor `text-muted-foreground`, sem exibir quando o valor for 0

### 2. Corrigir dados da Analise de Engajamento (limite de 1000 linhas)

**Problema identificado:** A query de mensagens WhatsApp no `useWhatsAppDashboardData.ts` busca mensagens individuais sem paginacao. O banco tem **3655 mensagens** no periodo atual (918 inbound + 2737 outbound na instancia Eternum Club), mas o Supabase retorna no maximo 1000 linhas por query. Resultado: os numeros exibidos estao significativamente abaixo do real.

Comparacao (periodo 12/02 a 26/02):

| Periodo | Inbound Real (DB) | Inbound Exibido (Tela) | Diferenca |
|---------|-------------------|----------------------|-----------|
| Manha   | 270               | 88                   | -67%      |
| Tarde   | 485               | 227                  | -53%      |
| Noite   | 163               | 102                  | -37%      |

**Solucao:** Substituir a query que busca mensagens individuais por uma abordagem de **agregacao no banco** usando consultas separadas por periodo e por dia, evitando o limite de 1000 linhas.

**Arquivo:** `src/hooks/useWhatsAppDashboardData.ts`

Substituir a query unica de mensagens (linhas 439-455) por **duas queries agregadas via RPC ou queries paginadas**:

**Opcao implementada: Paginacao com loop**

```typescript
// Buscar TODAS as mensagens com paginacao
let allMessages: any[] = [];
let page = 0;
const PAGE_SIZE = 1000;
let hasMore = true;

while (hasMore) {
  const { data: batch } = await supabase
    .from('zapp_messages')
    .select(`direction, sent_at, zapp_conversations!inner(integration_id, integrations!inner(account_id, sector_id))`)
    .eq('zapp_conversations.integrations.account_id', accountId)
    .eq('zapp_conversations.integrations.sector_id', 'vendas')
    .gte('sent_at', filters.startDate)
    .lte('sent_at', filters.endDate)
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  
  allMessages = allMessages.concat(batch || []);
  hasMore = (batch?.length || 0) === PAGE_SIZE;
  page++;
}
```

Em seguida, processar `allMessages` em vez de `messagesData` no loop existente de contagem por periodo e dia da semana.

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/whatsapp-dashboard/LeadsByDayChart.tsx` | Adicionar rotulos de total no topo de cada barra empilhada |
| `src/hooks/useWhatsAppDashboardData.ts` | Paginacao na query de mensagens para buscar todos os registros (corrige dados de engajamento) |

