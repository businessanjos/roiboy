# AGENTS.md — src/components/insights

- Insights (Vendas) view state lives in the URL query via `src/lib/insights/urlState.ts` (relative period presets, filters, foco/tv/zoom/atualizar) using history.replaceState; it never writes dashboard settings. Why: links open the same view on any device or TV without changing it for others.
- Seller company columns are opt-in through the visual's `rankingCompanyIds`; `useVisualData` partitions its already-filtered records by stored `deals.company_id` before aggregation. Why: shared sellers retain independent values/products without changing calls, other visuals, historical attribution or backend rules.
- Company rankings render one bounded seller column per company on all chart surfaces; TV fit includes stage chrome in its measured height and reserves enough height for company rankings. Why: positions remain vertically ordered, lone sellers never stretch across the screen, and fitting cannot clip the last row without changing saved layouts.
