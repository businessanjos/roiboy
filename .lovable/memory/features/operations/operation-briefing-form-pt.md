---
name: Operation Briefing Form
description: Briefing operacional estruturado substitui campo livre "Informação para Operação" — sincronizado entre Negócio e Cliente, obrigatório para Ganhar
type: feature
---
O comercial preenche o "Briefing para Operação" (tabela `deal_operation_briefings`) com campos estruturados (tempo de atuação, faturamentos, ticket, margem, foco, cidade, estrutura da clínica, funcionários, meta, especialidade, etc., baseados no questionário usado pelo Darlan). Aparece em DUAS abas sincronizadas: aba "Briefing Op." no DealDetailSheet (pipeline) e aba "Briefing Op." no ClientDetail (Operações). Ligação por `deal_id` e/ou `client_id`. Há 11 campos obrigatórios listados em `REQUIRED_BRIEFING_FIELDS` (src/components/operations/OperationBriefingForm.tsx). O `handleMarkAsWon` em SalesPipeline.tsx bloqueia o ganho se `is_complete = false`. O fluxo legado de transferência do custom_field "Informação para Operação" para a timeline foi mantido intencionalmente para negócios antigos.
