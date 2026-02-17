

## Corrigir: Exibir apenas meses do ano atual nas Metas Mensais

### Problema

O editor de metas mensais no VisualQuickSettings gera meses com `i = -2` a `i = 6`, o que inclui meses do ano anterior (ex: Dezembro de 2025). O usuario deseja ver apenas meses do ano corrente (2026).

### Mudanca

**`src/components/insights/visuals/VisualQuickSettings.tsx`**

Alterar a logica de geracao dos meses na secao "Metas Mensais" para listar todos os 12 meses do ano atual (Janeiro a Dezembro de 2026), em vez de usar o intervalo relativo de -2 a +6.

```typescript
const now = new Date();
const currentYear = now.getFullYear();
const months = [];
for (let m = 0; m < 12; m++) {
  const d = new Date(currentYear, m, 1);
  const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  months.push({ key, label });
}
```

Isso garante que apenas os meses de Janeiro a Dezembro do ano atual sejam exibidos.

