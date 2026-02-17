
## Expandir editor de metas no modal de criacao do Scorecard "Meta"

### Problema

Ao criar um Scorecard de "Meta", o modal exibe apenas um campo para a meta do mes atual. O usuario deseja poder inserir metas para todos os 12 meses do ano, da mesma forma que o editor de metas do Gauge "Faturamento x Meta" funciona nos ajustes rapidos (VisualQuickSettings).

### Mudancas

**`src/components/insights/AddVisualModal.tsx`**

1. Substituir o campo unico "Meta do Mes Atual (R$)" por um editor com os 12 meses do ano atual (Janeiro a Dezembro), identico ao que ja existe no VisualQuickSettings.

2. Trocar o state `gaugeGoal` (string unica) por um `monthlyGoals` (Record de string para string) para armazenar os valores de cada mes.

3. Na funcao de criacao, converter o `monthlyGoals` em `Record<string, number>` e salvar em `gaugeConfig.monthlyGoals`.

### Detalhes tecnicos

Trecho do editor de meses (mesmo padrao do VisualQuickSettings):

```typescript
const currentYear = new Date().getFullYear();
const months = [];
for (let m = 0; m < 12; m++) {
  const d = new Date(currentYear, m, 1);
  const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  months.push({ key, label });
}
```

Cada mes tera um campo de input numerico, e os valores serao salvos no config como `gaugeConfig.monthlyGoals`.

Na funcao `handleCreate`, converter:

```typescript
const parsedGoals: Record<string, number> = {};
Object.entries(monthlyGoals).forEach(([k, v]) => {
  const num = Number(v);
  if (num > 0) parsedGoals[k] = num;
});
```

### Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `AddVisualModal.tsx` | Substituir input unico por editor de 12 meses para scorecard de "Meta" |
