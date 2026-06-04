---
name: HR Job Offers System
description: Cartas-Proposta no RH com wizard de 6 passos e link público em iamroy.app/oferta/<token>
type: feature
---
- Tabela `hr_job_offers` armazena offers com `public_token`, accent_color, perks JSONB, benefícios array.
- Rotas: `/rh/offers` (lista), `/rh/offers/new` e `/rh/offers/:id/edit` (wizard), `/oferta/:token` (público).
- Wizard: Candidato → Posição → Remuneração → Conteúdo → Design (cor + capa) → Revisão.
- Link público usa `getPublicOrigin()` (iamroy.app em prod). Página pública incrementa view_count, marca `viewed`, permite Accept/Decline com mensagem.
- Card no RHDashboard em "Gestão de Pessoas" entre Vagas e Banco de Talentos.
