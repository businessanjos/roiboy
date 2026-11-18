# AGENTS.md — src/components/insights

- Insights (Vendas) view state lives in the URL query via `src/lib/insights/urlState.ts` (relative period presets, filters, foco/tv/zoom/atualizar) using history.replaceState; it never writes dashboard settings. Why: links open the same view on any device or TV without changing it for others.
