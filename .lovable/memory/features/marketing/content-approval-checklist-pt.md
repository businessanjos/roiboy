---
name: content-approval-checklist
description: Aba Checklist em Marketing > Social Media com o checklist oficial de aprovação de conteúdo da Eternum (uso da Jessica), com bloqueios automáticos e histórico salvo.
type: feature
---

# Checklist Oficial de Aprovação de Conteúdo

**Local:** `/social-media` (Marketing > Social Media) > aba **Checklist**.

- Schema declarativo em `src/components/marketing/contentChecklistSchema.ts` (4 etapas: Antes de criar, Qualidade, Execução por formato, Validação final).
- UI em `src/components/marketing/ContentChecklistTab.tsx`.
- Itens `negative: true` são reprovação automática — se marcados, bloqueiam o botão "Aprovado para enviar à Bruna".
- Seções com `formats: [...]` só aparecem quando o formato correspondente é selecionado (Carrossel assunto em alta, Carrossel educativo, Revista, Outdoor prova social).
- Aprovação só libera com 100% dos itens positivos e zero bloqueios.
- Persistência: tabela `content_approval_checklists` (RLS por `account_id` via `public.users`), campos: post_title, responsible, post_date, format, pilar, objetivo, ideia_central, answers jsonb, decision (pending|approved|adjust|rejected).
- Regra de negócio: conteúdo é para EMPRESÁRIOS da estética, nunca iniciantes nem pacientes; percepção premium/high ticket obrigatória.

## Notificações de reprovação automática
- Campo **Responsável** é um seletor de usuário (`responsible_user_id`), não texto livre — é quem recebe a notificação.
- Ao salvar com itens negativos marcados, `src/lib/contentChecklistNotifications.ts` insere em `notifications` (type `content_checklist_blocker`, link `/social-media?platform=checklist`).
- Colunas de controle: `blockers` jsonb (bloqueios já notificados) e `last_blocker_notified_at` — só bloqueios novos disparam notificação, evitando spam ao reeditar.
- Sem responsável selecionado, quem preencheu recebe o aviso.
