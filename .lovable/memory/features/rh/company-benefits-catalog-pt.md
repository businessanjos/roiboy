---
name: HR Company Benefits Catalog
description: Catálogo oficial de benefícios da empresa em /rh/benefits, base para vagas e benchmark
type: feature
---
- Tabela `hr_company_benefits` (por account): name, category, provider, monthly_value, employee_contribution, contract_types[], is_highlight, include_in_jobs_by_default, use_in_benchmark, is_active, sort_order.
- Página `/rh/benefits` (`src/pages/rh/RHBenefits.tsx`) + hook `useHRCompanyBenefits` (categorias em `BENEFIT_CATEGORY_LABELS`). Item no menu RH "Benefícios" (ícone Gift).
- `JobStepCompensation` lista os benefícios do catálogo (filtrados pelo contract_type da vaga), pré-seleciona os `include_in_jobs_by_default` em vagas novas e mostra o restante como "Outros diferenciais" (JOB_BENEFITS sem duplicar catálogo).
- Regra do chip "Salário compatível com o mercado" (marketSalaryClaim) continua valendo sobre os extras.
