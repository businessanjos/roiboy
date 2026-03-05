

## Plano: Exibir minutos quando tempo < 1 hora

### Alteração em `src/components/insights/whatsapp-dashboard/TimePerStageCard.tsx`

Atualizar `formatDuration` para 3 faixas:

- `< 1/24 dia` (< 1 hora): exibir em minutos → `Xmin`
- `< 1 dia` (1-23h): exibir em horas → `Xh`
- `≥ 1 dia`: exibir em dias → `X dias`

```typescript
function formatDuration(days: number): string {
  if (days === 0) return '0min';
  const totalMinutes = days * 24 * 60;
  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)}min`;
  }
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? 'dia' : 'dias'}`;
}
```

### Arquivo afetado
- `src/components/insights/whatsapp-dashboard/TimePerStageCard.tsx`

