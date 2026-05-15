---
name: Client Milestones (Hall da Fama)
description: Sistema de marcos do cliente com bento grid + checklist de celebração + auto-detecção via Ryka
type: feature
---

Sistema de Marcos por cliente, dentro da aba **CX** em `/clients/:id?tab=cx` (acima dos Momentos CX).

## Tabelas
- `client_milestones` — cada conquista (tipo, título, data, value_label, notes, cover_url, 6 booleanos de checklist: done_recognition/symbol/prize/experience/post/status, auto_detected). Unique `(client_id, milestone_type, achieved_at) WHERE auto_detected = true`.
- `client_ryka_stats` — métricas mensais por cliente vindas da Ryka (period_month dia 01, revenue_brl, patients_count, raw_payload). Unique `(client_id, period_month)`.

## Tipos de marco
`first_million`, `record_month`, `expansion`, `hundred_patients_month`, `two_years`, `custom`.

## Auto-detecção
Trigger `detect_client_milestones` em INSERT/UPDATE de `client_ryka_stats` cria marcos automáticos:
- 1º milhão: soma acumulada >= 1.000.000
- Mês recorde: revenue_brl > MAX(revenue_brl) anterior (e > 0)
- 100 pacientes/mês: patients_count >= 100
- 2 anos: aniversário do MIN(start_date) de contratos active/paused/suspended

## Endpoint Ryka
`POST clinica-ryka-api?action=report_client_stats` com `{ client_id, period_month, revenue_brl, patients_count, raw }`. Auth via `x-api-key: CLINICA_RYKA_API_KEY`. Faz upsert em `client_ryka_stats`, dispara o trigger, retorna marcos detectados.

## UI
`src/components/client/ClientMilestones.tsx` — bento grid responsivo, primeiro card é hero (col-span-2 row-span-2), badge "Auto" para auto_detected, gradientes por tipo, progress bar de celebração, dialog editor com checklist de 6 itens.
