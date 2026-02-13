

## Corrigir visual "Leads por MQL" para ler dados dos campos personalizados

### Problema
O visual "Leads por MQL" mostra "Nao informado (100%)" porque a funcao `fetchLeadsData` no hook `useVisualData.ts` nao busca o valor de MQL na tabela `lead_field_values`. O campo MQL do Lead e um campo personalizado (ID: `e4270e93-e9b9-4d9b-9589-d614ce335bcd`) armazenado em `lead_field_values`, nao na coluna `leads.mql`.

Ja existe uma funcao similar para Deals (`enrichDealsWithMql`) que busca o MQL da tabela `deal_field_values`. Precisamos replicar essa logica para Leads.

### Mapeamento

| Opcao (value_text)  | Label               | Cor     |
|---------------------|----------------------|---------|
| `opt_1`             | SIM - Acima de 30k   | #22c55e |
| `opt_2`             | NAO - Abaixo de 30k  | #ef4444 |

### Mudanca tecnica

**Arquivo: `src/hooks/useVisualData.ts`**

1. Criar constante `LEAD_MQL_FIELD_ID = 'e4270e93-e9b9-4d9b-9589-d614ce335bcd'`

2. Criar mapa de valores para o MQL de Leads:
```text
const LEAD_MQL_VALUE_MAP = {
  opt_1: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  opt_2: { label: 'NAO - Abaixo de 30k', color: '#ef4444' },
};
```

3. Criar funcao `enrichLeadsWithMql(accountId, leads)` similar a `enrichDealsWithMql`, mas buscando de `lead_field_values` em vez de `deal_field_values`, e usando `lead_id` em vez de `deal_id`.

4. Na funcao `fetchLeadsData`, apos coletar todos os leads, verificar se o agrupamento e por `mql`. Se for, chamar `enrichLeadsWithMql` antes de agregar os dados — exatamente como ja e feito para Deals na funcao `fetchDealsData` (linhas 337-339).

### O que nao muda
- Visuais de MQL de Deals (continuam usando `deal_field_values`)
- UI do perfil do Lead (ja exibe MQL corretamente)
- Demais agrupamentos de Leads (por data, status, etc.)
