---
name: Guia de Encaminhamento — Eternum fixa
description: CNPJ e razão social da Eternum hardcoded no ExamReferralDialog (não editável via defaults)
type: feature
---
No `ExamReferralDialog` (Guia de Encaminhamento de exame ocupacional), os campos `cnpj` e `company_name` são sempre hardcoded:
- CNPJ: `53.844.206/0001-64`
- Razão social: `Eternum Mentoring Club Ltda`

Não puxar de `hr_exam_referral_defaults` nem de `existing.cnpj/company_name`. Sempre sobrescrever no load do dialog.
