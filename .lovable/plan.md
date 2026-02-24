

## Corrigir bypass de campos obrigatorios ao mover negocio via DealDetailSheet

### Problema

O `DealDetailSheet` (painel lateral de detalhes do negocio) permite alterar a etapa do negocio via um dropdown Select **sem validar campos obrigatorios**. A validacao so existe em 3 lugares:

1. `DealKanban.tsx` - drag-and-drop no pipeline
2. `ZappDealDetailSheet.tsx` - painel no ROY Zapp
3. `ZappCRMPanel.tsx` - CRM no ROY Zapp

Mas o `DealDetailSheet` e usado em **4 contextos** diferentes (SalesPipeline, Leads, LeadsTab, ClientDeals) e nenhum deles valida campos obrigatorios antes de mover.

### Causa raiz

A funcao `handleStageChange` no `DealDetailSheet` (linha 654) chama `onStageChange(deal.id, newStageId)` diretamente, sem passar pela validacao de `useRequiredFieldsValidation().validateDealMove()`.

```text
Fluxo atual (sem validacao):
  Select dropdown → handleStageChange() → onStageChange() → moveDeal() → UPDATE direto

Fluxo correto (com validacao):
  Select dropdown → handleStageChange() → validateDealMove()
    → Se campos faltando → abrir RequiredFieldsModal
    → Se tudo preenchido → onStageChange() → moveDeal()
```

### Solucao

#### `src/components/sales/DealDetailSheet.tsx`

1. Importar `useRequiredFieldsValidation` e `RequiredFieldsModal`
2. Adicionar estado para o modal de campos obrigatorios
3. Modificar `handleStageChange` para validar antes de mover:
   - Chamar `validateDealMove(deal.id, newStageId, deal.account_id)`
   - Se `canMoveToStage === false`, abrir o `RequiredFieldsModal` com os campos faltantes
   - Se `canMoveToStage === true`, mover normalmente
4. Adicionar o componente `RequiredFieldsModal` no JSX
5. No callback `onComplete` do modal, executar o `onStageChange` e fechar o modal

Isso centraliza a validacao no proprio componente, cobrindo automaticamente todos os 4 contextos onde ele e usado (SalesPipeline, Leads, LeadsTab, ClientDeals).

### Arquivos alterados

- **`src/components/sales/DealDetailSheet.tsx`**: Adicionar validacao de campos obrigatorios no `handleStageChange` e renderizar `RequiredFieldsModal`

### Resultado esperado

- Nenhum usuario consegue mover um negocio de etapa sem preencher campos obrigatorios, independente de onde esteja (pipeline drag-and-drop, DealDetailSheet, ROY Zapp)
- A experiencia e consistente: o mesmo modal de campos obrigatorios aparece em todos os contextos

