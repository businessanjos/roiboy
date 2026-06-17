---
name: HR Offboarding Suite v2
description: Área /rh/offboarding completa — stepper, prazos legais, anexos, pendências/reatribuição, timeline auditável, link público de entrevista, lançamento financeiro, dossiê PDF, Kanban
type: feature
---
# Desligamentos RH (/rh/offboarding) — v2

## Tabelas
- `hr_offboardings` — registro principal. Campos novos v2: `exit_interview_token` (link público), `exit_interview_submitted_at`, `subject_type` (collaborator|service_provider), `service_provider_id`, `financial_entry_id`, `reassignments` jsonb.
- `hr_offboarding_checklist_items` — itens por categoria. Seed automático de 17 itens.
- `hr_offboarding_documents` — anexos (TRCT, aviso, exame demissional, recibos) com bucket privado `offboarding-docs` (`{account_id}/{offboarding_id}/...`).
- `hr_offboarding_timeline` — auditoria. Trigger `log_offboarding_timeline` registra criação, mudança de etapa, corte de acesso, submissão de entrevista.

## UX (drawer 7 abas)
1. **Resumo** — formulário + card de Prazos Legais (TRCT 10d, FGTS 10d, Homologação 10d, CAGED dia 7) com cores por severidade (lib `offboardingDeadlines.ts`).
2. **Pendências** — `useCollaboratorPendencies` conta tarefas/deals/clientes abertos do user vinculado. `ReassignDialog` reatribui em massa via `reassignCollaboratorResources`.
3. **Checklist** — categorias + botão "Adicionar todos" para `EXTERNAL_ACCESS_SYSTEMS` (Google, RoyZapp, Omie, Pluggy, Meta, IG, YT, Notion, GitHub, 1Password, Slack).
4. **Rescisão** — calculadora CLT + botão "Criar lançamento financeiro" (insere em `financial_entries` type=expense pending vinculado via `financial_entry_id`).
5. **Documentos** — upload por categoria (DOCUMENT_CATEGORIES) via `useOffboardingDocuments` → bucket privado com signed URL 1 ano.
6. **Saída** — gera/copia link público `/desligamento/saida/:token` (página `PublicExitInterview`), corte de acesso da plataforma, entrevista interna.
7. **Timeline** — eventos da `hr_offboarding_timeline` em ordem cronológica reversa.

Stepper visual no topo (clicável para mover etapa). Alerta global se há prazo vencido ou pendências > 0.

## Dossiê PDF (`src/lib/exportOffboardingPDF.ts`)
Exporta tudo: cabeçalho, dados, prazos, rescisão completa, checklist, documentos, timeline, entrevista. Botão no header do drawer.

## Lista (RHOffboarding.tsx)
- KPIs: Total, Em andamento, Este mês, Vagas a repor, **Custo do mês** (soma `rescission_calc.result.net` dos completed do mês), **Tempo médio** (dias entre criação e conclusão).
- Filtros: busca, etapa, tipo, período (30/90/365d).
- Toggle Lista vs **Kanban** por etapa (6 colunas).
- Badge "Entrevista respondida" no row quando `exit_interview_submitted_at` setado.

## Entrevista pública (`/desligamento/saida/:token`)
Page `PublicExitInterview` lê por token (RLS permite anon SELECT/UPDATE pelo token). Submete `exit_interview`, `exit_nps`, `exit_interview_submitted_at`. Token gerado on-demand via `ensureExitInterviewToken`.

## Acesso
Restrito a `RH_ALLOWED_EMAILS`. Página pública não exige login (valida token).
