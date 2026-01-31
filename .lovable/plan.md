

# Plano: Dashboard Conversas/WhatsApp no Insights

## Visao Geral

Criar um dashboard customizado para o painel "Conversas/WhatsApp" na aba Insights de Vendas, utilizando dados reais do pipeline de deals, etapas do funil, e mensagens do WhatsApp da instancia de vendas (`sector_id = 'vendas'`).

---

## Dados Disponiveis no Sistema

### Pipeline de Vendas (deals + deal_stages)
| Etapa | Qtd | Valor Total |
|-------|-----|-------------|
| Chegou Lead | 30 | R$ 0 |
| Contato Realizado | 227 | R$ 16.7M |
| Em Qualificacao | 48 | R$ 3.9M |
| Reuniao Agendada | 5 | R$ 524k |
| No Show | 39 | R$ 3.6M |
| Reuniao Concluida | 5 | R$ 523k |
| Proposta Enviada | 26 | R$ 2.6M |
| Follow Up | 93 | R$ 7M |

### Status de Deals
- 473 abertos
- 38 ganhos
- 8 perdidos

### Mensagens WhatsApp Vendas (ultimos 30 dias)
- 12.489 mensagens totais
- 4.642 recebidas (inbound)
- 7.847 enviadas (outbound)

### Engajamento por Dia da Semana (Vendas)
- Domingo: 247 msg
- Segunda: 1.989 msg (pico)
- Terca: 2.146 msg
- Quarta: 2.139 msg
- Quinta: 2.617 msg (pico)
- Sexta: 2.804 msg (maior volume)
- Sabado: 547 msg

---

## Estrutura do Dashboard

### Secao 1: Cards do Pipeline (Topo)

6-8 cards horizontais mostrando cada etapa do funil:

```text
+--------+--------+--------+--------+--------+--------+--------+
| Chegou | Contato| Em     | Reuniao| No     | Proposta| Follow |
| Lead   | Realiz.| Qualif.| Agend. | Show   | Enviada | Up     |
| 30     | 227    | 48     | 5      | 39     | 26      | 93     |
| ---    | 100%   | 21%    | 10%    | 17%    | 11%     | 41%    |
+--------+--------+--------+--------+--------+--------+--------+
```

**Dados:** Query em `deals` + `deal_stages` agrupado por etapa, calculando percentual relativo

### Secao 2: Funil Visual

Grafico de barras horizontais empilhadas mostrando o afunilamento:

```text
Chegou Lead      ==================== 100%
Contato          ================ 80%
Em Qualificacao  ========= 40%
Reuniao          ===== 20%
Proposta         === 12%
Ganho            = 5%
```

**Componente:** Recharts BarChart horizontal com cores por etapa

### Secao 3: Scorecards de Conversao

3 cards com metricas chave:

| Conversao Total | Lead -> Contato | Contato -> Proposta |
|-----------------|-----------------|---------------------|
| 8% | 45% | 60% |

**Dados:** Calculos baseados em `deal_activities` (type = 'stage_change')

### Secao 4: Leads por Dia (Line Chart)

Grafico de linhas dos ultimos 14 dias:
- Eixo X: Datas
- Eixo Y: Quantidade de leads/deals criados
- Agrupado por fonte (source)

**Dados:** Query em `leads` ou `deals` com `DATE(created_at)` e `source`

### Secao 5: Tempo por Etapa

Card vertical com tempos medios de transicao:

```text
Tempo por Etapa
---------------------------------
Lead -> Contato Realizado    9d
Contato -> Em Qualificacao   11d
Qualificacao -> Reuniao      4d
Reuniao -> Proposta          2d
---------------------------------
Ciclo Total de Vendas       43d
```

**Dados:** Query em `deal_activities` calculando `AVG(created_at - prev_created_at)` por transicao

### Secao 6: Analise de Engajamento WhatsApp

#### Por Periodo do Dia (3 cards)

| Manha (8h-12h) | Tarde (12h-18h) | Noite (18h-22h) |
|----------------|-----------------|-----------------|
| Taxa: 65% | Taxa: 72% | Taxa: 58% |
| 1.2k recebidas | 3.5k recebidas | 2.1k recebidas |
| 800 enviadas | 2.8k enviadas | 1.4k enviadas |

**Dados:** Query em `zapp_messages` filtrado por `sector_id = 'vendas'` agrupado por `EXTRACT(HOUR FROM sent_at)`

#### Por Dia da Semana (7 cards)

```text
[Dom] [Seg] [Ter] [Qua] [Qui] [Sex*] [Sab]
 247  1.9k  2.1k  2.1k  2.6k  2.8k   547
                              ^melhor
```

**Dados:** Query em `zapp_messages` agrupado por `EXTRACT(DOW FROM sent_at)`

### Secao 7: Tempo Economizado (Bonus)

Card especial mostrando metricas de produtividade:
- Tempo total economizado pela automacao
- Calculado com base em mensagens automaticas vs manuais

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | Container principal do dashboard |
| `src/components/insights/whatsapp-dashboard/PipelineCards.tsx` | Cards horizontais do funil |
| `src/components/insights/whatsapp-dashboard/SalesFunnelChart.tsx` | Grafico visual do funil |
| `src/components/insights/whatsapp-dashboard/ConversionScoreCards.tsx` | 3 scorecards de conversao |
| `src/components/insights/whatsapp-dashboard/LeadsByDayChart.tsx` | Grafico de linha de leads/dia |
| `src/components/insights/whatsapp-dashboard/TimePerStageCard.tsx` | Card de tempo por transicao |
| `src/components/insights/whatsapp-dashboard/EngagementByPeriodCards.tsx` | Cards Manha/Tarde/Noite |
| `src/components/insights/whatsapp-dashboard/EngagementByDayCards.tsx` | Cards Dom-Sab |
| `src/components/insights/whatsapp-dashboard/index.ts` | Export barrel |
| `src/hooks/useWhatsAppDashboardData.ts` | Hook para todas as queries do dashboard |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/InsightsMainContent.tsx` | Detectar painel "Conversas" e renderizar dashboard customizado |

---

## Detalhes Tecnicos

### Hook useWhatsAppDashboardData

```typescript
interface WhatsAppDashboardData {
  // Pipeline
  stageDistribution: {
    name: string;
    count: number;
    value: number;
    color: string;
    conversionPct: number;
  }[];
  
  // Conversoes
  overallConversion: number; // won / total %
  
  // Leads por dia
  leadsByDay: {
    date: string;
    label: string;
    count: number;
    sources: Record<string, number>;
  }[];
  
  // Tempos
  avgTimePerTransition: {
    from: string;
    to: string;
    avgDays: number;
  }[];
  
  // Engajamento WhatsApp (vendas)
  engagementByPeriod: {
    period: 'Manha' | 'Tarde' | 'Noite';
    inbound: number;
    outbound: number;
    responseRate: number;
  }[];
  
  engagementByDayOfWeek: {
    day: number; // 0=Dom, 1=Seg...
    dayName: string;
    inbound: number;
    outbound: number;
    total: number;
  }[];
  
  isLoading: boolean;
}
```

### Queries Principais

**Pipeline por Etapa:**
```sql
SELECT 
  ds.name, ds.color, ds.display_order,
  COUNT(d.id) as count,
  SUM(d.value) as value
FROM deal_stages ds
LEFT JOIN deals d ON d.stage_id = ds.id AND d.status = 'open'
WHERE ds.account_id = :accountId
GROUP BY ds.id
ORDER BY ds.display_order
```

**Engajamento por Periodo (Vendas):**
```sql
SELECT 
  CASE 
    WHEN EXTRACT(HOUR FROM zm.sent_at) BETWEEN 8 AND 11 THEN 'Manha'
    WHEN EXTRACT(HOUR FROM zm.sent_at) BETWEEN 12 AND 17 THEN 'Tarde'
    ELSE 'Noite'
  END as period,
  zm.direction,
  COUNT(*) as count
FROM zapp_messages zm
JOIN zapp_conversations zc ON zm.zapp_conversation_id = zc.id
JOIN integrations i ON zc.integration_id = i.id
WHERE i.sector_id = 'vendas'
  AND zm.sent_at >= :startDate
  AND zm.sent_at <= :endDate
GROUP BY period, direction
```

**Engajamento por Dia da Semana (Vendas):**
```sql
SELECT 
  EXTRACT(DOW FROM zm.sent_at) as day_of_week,
  zm.direction,
  COUNT(*) as count
FROM zapp_messages zm
JOIN zapp_conversations zc ON zm.zapp_conversation_id = zc.id
JOIN integrations i ON zc.integration_id = i.id
WHERE i.sector_id = 'vendas'
  AND zm.sent_at >= :startDate
  AND zm.sent_at <= :endDate
GROUP BY day_of_week, direction
ORDER BY day_of_week
```

---

## Fluxo de Deteccao do Painel

Em `InsightsMainContent.tsx`:

```typescript
// Verificar se o painel ativo e relacionado a WhatsApp/Conversas
const isWhatsAppDashboard = activeDashboard?.name
  ?.toLowerCase()
  .includes('conversas') || 
  activeDashboard?.name?.toLowerCase().includes('whatsapp');

// Se for e nao tiver visuais customizados, renderizar dashboard especial
if (isWhatsAppDashboard && (!visuals || visuals.length === 0)) {
  return <WhatsAppDashboardPanel />;
}
```

---

## Layout Visual Final

```text
+------------------------------------------------------------------+
|  Pipeline de Conversao                                            |
|  [Chegou][Contato][Qualif.][Reuniao][NoShow][Proposta][FollowUp] |
+------------------------------------------------------------------+
|                                                                   |
|  [Funil Visual - BarChart Horizontal]                            |
|                                                                   |
+------------------------------------------------------------------+
|  Conversao  |  Lead->Contato  |  Contato->Proposta               |
|    8%       |      45%        |        60%                        |
+------------------------------------------------------------------+
|  [Leads por Dia - Line Chart]      |  Tempo por Etapa            |
|                                     |  Lead->Contato: 9d         |
|  Ultimos 14 dias                   |  Contato->Qualif: 11d      |
|                                     |  ...                        |
|                                     |  Ciclo Total: 43d          |
+------------------------------------------------------------------+
|  Analise de Engajamento WhatsApp (Vendas)                        |
|                                                                   |
|  Por Periodo:                                                    |
|  [Manha 8h-12h] [Tarde 12h-18h *] [Noite 18h-22h]               |
|                                                                   |
|  Por Dia da Semana:                                              |
|  [Dom] [Seg] [Ter] [Qua] [Qui] [Sex*] [Sab]                     |
+------------------------------------------------------------------+
```

---

## Resultado Esperado

1. Dashboard completo com dados reais do sistema
2. Metricas de pipeline usando `deals` e `deal_stages` existentes
3. Engajamento WhatsApp filtrado apenas para instancias de vendas
4. Respeito aos filtros globais de data do Insights
5. Layout responsivo seguindo o padrao visual do sistema
6. Atualizacao automatica via React Query

