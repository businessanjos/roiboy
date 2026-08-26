---
name: Gráficos no padrão Ryka
description: Todos os gráficos usam o layout do Design Model Ecossistema Ryka — tema global Recharts + primitives SVG em src/components/charts/ryka
type: design
---
Todo gráfico do sistema segue o "Design Model - Ecossistema Ryka".

- Primitives portadas: `src/components/charts/ryka/` (`AreaChart`, `DonutChart`, `StackedBar`, `ChartLegend`, `Sparkline`, `BarSeries`, `chartColor`, `RYKA_CHART_COLORS`). Usar em telas novas.
- Recharts existente: tema global no `@layer components` do `src/index.css` (bloco "Tema Ryka para gráficos"). Define grid hairline contínuo (sem `strokeDasharray`), ticks `tabular-nums` em `--muted-foreground`, tooltip glass, legenda discreta, barras com `rx/ry: 6px`, sectors com stroke `--card`.
- Cores de série: sempre `hsl(var(--chart-1..5))`. Nunca hex ou `--primary`/`--muted-foreground` como cor de série.
- Grade: `<CartesianGrid vertical={false} stroke="hsl(var(--hairline))" />`.
