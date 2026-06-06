---
name: HR Offboarding Suite
description: Área completa /rh/offboarding com motivo, rescisão CLT, checklist, corte de acesso à plataforma e entrevista de saída
type: feature
---
# Desligamentos RH (/rh/offboarding)

## Tabelas
- `hr_offboardings` — registro principal por colaborador (tipo, datas, aviso, motivo, will_replace, replacement_job_id, stage, rescission_calc JSONB, exit_interview JSONB, exit_nps, access_cutoff).
- `hr_offboarding_checklist_items` — itens por categoria (geral/documentos/financeiro/acessos/equipamentos). Trigger `seed_offboarding_checklist` cria 17 itens padrão na inserção.

## Comportamentos automáticos
- **Reposição de vaga**: ao criar com `will_replace=true`, hook cria rascunho em `hr_jobs` (status=draft) com position/department/contract_type do colaborador e salva `replacement_job_id`.
- **Conclusão (stage='completed')**: trigger `apply_offboarding_completion` marca `hr_collaborators.status='inactive'` + `termination_date` e seta `users.is_active=false` se houver `user_id` vinculado. Bloqueia login na plataforma.
- **Cancelamento (stage='cancelled')**: grava `cancelled_at` sem inativar.

## Calculadora de Rescisão (src/lib/rescissionCalc.ts)
- Implementa CLT completa: saldo salário, aviso prévio (indenizado/50% no 484-A), férias vencidas+1/3, férias proporcionais+1/3, 13º proporcional, INSS progressivo 2025, IRRF com dependentes, depósito FGTS 8%, multa FGTS (40% sem justa causa / 20% acordo / 0% pedido demissão / justa causa).
- Salvo em `rescission_calc` como `{ inputs, result, savedAt }`.
- Banner: "estimativa — valores oficiais via contabilidade/eSocial".

## Acesso
- Restrito a `RH_ALLOWED_EMAILS` (Quintana + Everton) como demais páginas RH.
- Rota em src/App.tsx; sidebar já apontava em src/config/sectors.ts → "/rh/offboarding".
