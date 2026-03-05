

## Plano: Tag de status do negócio ao lado do nome do lead

### O que será feito
Adicionar uma tag colorida ao lado do nome de cada lead na tabela, indicando o status do negócio mais recente vinculado: **Aberto** (azul), **Ganho** (verde) ou **Perdido** (vermelho). Leads sem negócio não terão tag.

### Alterações

#### 1. `src/hooks/useVisualDrilldown.ts` — Enriquecer com status do deal
- Na função `fetchDealSourceForLeads`, já buscamos deals com `id, lead_id, created_at`. Basta adicionar `status` ao select.
- Retornar um segundo Map `dealStatusMap: Map<leadId, status>` junto com o existente, ou alterar para retornar um objeto `{ source: Map, status: Map }`.
- Em `fetchLeadsRecords`, injetar `extra.deal_status` no DrilldownRecord de cada lead.

#### 2. `src/components/insights/visuals/ConfigurableTable.tsx` — Renderizar tag
- Alterar a coluna `name` em `LEAD_COLUMNS` para que o `getValue` retorne apenas o texto, mas criar uma renderização customizada.
- Adicionar uma propriedade opcional `render` ao `TableColumnDef` para permitir JSX customizado.
- Na coluna `name` dos leads, renderizar o nome + uma badge colorida com o status do deal (`extra.deal_status`):
  - `won` → badge verde "Ganho"
  - `lost` → badge vermelha "Perdido"  
  - `open` → badge azul "Aberto"
  - sem deal → sem badge

### Detalhes técnicos

```typescript
// DrilldownRecord.extra terá:
extra: {
  deal_source: "instagram",
  deal_status: "won" | "lost" | "open" | undefined,
}

// Coluna name renderiza:
// "Daniela Becker" [Ganho]  ← badge verde
```

### Arquivos afetados
- `src/hooks/useVisualDrilldown.ts` — adicionar `status` ao fetch de deals e mapear para `extra.deal_status`
- `src/components/insights/visuals/ConfigurableTable.tsx` — adicionar render customizado com badge na coluna nome (apenas para leads)

