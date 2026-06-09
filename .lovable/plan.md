# Evolução da área de Vagas (RH)

Hoje a vaga tem descrição, requisitos, salário e tags — mas falta clareza sobre **quem é o dono**, **quando precisa fechar**, **como é o processo** e **o que avaliar em cada candidato**. Vamos resolver isso em 4 frentes.

## 1. Gestão da vaga (dono + prazo)

Adicionar no wizard (passo "Básico" e "Processo"):
- **Gestor responsável (Hiring Manager)** — usuário do sistema que aprova candidatos.
- **Recrutador responsável** — quem toca o processo (RH).
- **Prazo ideal para fechar a vaga** (`target_fill_date`) — diferente de "prazo para candidatura".
- **Data de abertura** automática + **dias em aberto** visível no card.
- **Motivo da abertura**: nova posição / reposição / expansão.
- Badge de **SLA** no card: verde (no prazo), amarelo (próximo do prazo), vermelho (atrasada).

## 2. Etapas do processo (pipeline customizável por vaga)

Hoje as etapas são fixas (`applied → screening → interview → technical_test → offer → hired`). Vamos permitir **etapas customizadas por vaga**, mantendo as default:

- Nova tabela `hr_job_stages` (job_id, name, order, type, sla_days, ai_focus).
- Cada etapa tem:
  - **Nome** (ex: "Entrevista com gestor", "Case prático", "Cultural fit")
  - **SLA em dias** (quanto tempo o candidato pode ficar parado)
  - **Responsável** (RH, gestor, técnico)
  - **O que avaliar** (campo livre + sugerido pela IA)
- Wizard ganha passo **"Processo Seletivo"** onde IA sugere etapas com base no cargo/senioridade.

## 3. IA: matching candidato ↔ vaga

Nova edge function `analyze-candidate-match` (Lovable AI, `google/gemini-3-flash-preview`):

**Input:** vaga (descrição, requisitos, etapas, o-que-avaliar) + currículo/resposta do candidato.

**Output estruturado:**
- `match_score` (0-100)
- `strengths[]` — pontos fortes alinhados à vaga
- `gaps[]` — lacunas vs requisitos
- `red_flags[]` — alertas
- `stage_focus[]` — por etapa: "o que investigar neste candidato"
- `recommended_questions[]` — perguntas sugeridas para a entrevista
- `verdict` — `strong_match` | `possible` | `weak` | `reject`

Exibido no detalhe do candidato (`RHJobDetail`) em um painel "Análise IA" + na coluna do Kanban como badge de score.

## 4. IA: sugestão de etapas e critérios

Botão **"Sugerir etapas com IA"** no wizard, na etapa "Processo":
- IA lê título + descrição + senioridade + contract_type.
- Devolve 3-6 etapas com nome, SLA sugerido e bullets de "o que observar".
- Usuário aceita / edita / remove.

---

## Detalhes técnicos

**Migrações:**
1. `hr_jobs`: adicionar `hiring_manager_id uuid`, `recruiter_id uuid`, `target_fill_date date`, `opening_reason text`, `opened_at timestamptz default now()`.
2. Nova tabela `hr_job_stages` (id, job_id, name, order_index, sla_days, owner_role, evaluation_criteria text[], ai_focus text). GRANTs + RLS por account.
3. `hr_job_applications`: adicionar `current_stage_id uuid` (substitui gradualmente `stage` enum), `ai_match_score int`, `ai_match_report jsonb`, `stage_entered_at timestamptz`.

**Edge functions novas:**
- `suggest-job-stages` — gera etapas sugeridas.
- `analyze-candidate-match` — análise candidato↔vaga.

**Frontend:**
- `JobStepBasicInfo`: campos de gestor/recrutador/prazo.
- Novo `JobStepProcess` (substitui o atual) com editor de etapas + botão IA.
- `RHVagas` (lista): badge de SLA, contagem de dias em aberto, gestor visível.
- `RHJobDetail`: painel "Análise IA" por candidato + foco por etapa.
- Kanban: colunas dinâmicas (etapas da vaga) + badge de score IA.

---

## Posso fazer tudo de uma vez, mas sugiro entregar em 2 PRs:

**PR1 (rápido):** gestor + recrutador + prazo + opening_reason + SLA visual na lista. Sem mudar etapas.

**PR2 (maior):** etapas customizadas + IA de sugestão + IA de match no candidato.

Confirma se topa o plano e por qual PR começo (ou faço os dois seguidos)?
