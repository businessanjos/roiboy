---
name: Ligações 3C viram atividade com transcrição e resumo por IA
description: Pipeline threecplus-process-calls + threecplus-transcribe-call que vincula ligações a leads/negociações e gera transcrição e resumo de vendas
type: feature
---

- `threecplus-process-calls`: casa cada ligação de `threecplus_call_logs` com lead/cliente por variantes de telefone (`_shared/phone-normalize.ts`, lookup em lotes de 400) e com o usuário ROY via `threecplus_agents.external_agent_id`. Cria atividade `deal_activities` tipo `call` idempotente pelo marcador `[3c:{call_id}]`, grava `activity_id`, `recording_url`, `linked_at`, atualiza `clients.last_contact_at` e insere em `lead_timeline` (`event_type` + `title` obrigatórios).
- `threecplus-transcribe-call`: baixa a gravação (token Gestor), transcreve com `google/gemini-3.5-transcribe` (streaming SSE) e resume com `openai/gpt-6-astra` via `/v1/responses` com json_schema estrito (resumo, contexto_do_lead, dores, objecoes, proximos_passos, temperatura, compromissos_agendados). Fila em `threecplus_call_transcripts` (pending/processing/done/error, máx. 5 tentativas, lotes de 5).
- Crons: `threecplus-process-calls-hourly` (27 * * * *) e `threecplus-transcribe-queue-6h` (5 */6 * * *). A sync (`threecplus-sync-calls`) dispara o processamento ao final.
- UI: `ThreeCPlusCallsList` em Vendas > Gestão > Performance > Telefonia (filtros vendedor/período/resultado/temperatura, contadores, transcrever/reprocessar, player e transcrição). `DealDetailSheet` toca a gravação em atividades `call`.
