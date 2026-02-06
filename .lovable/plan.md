

# Plano: Adicionar Validação de Campos Obrigatórios no ROY zAPP

## Problema Identificado

Atualmente, dentro do ROY zAPP, é possível mover negócios entre etapas e marcá-los como Ganho/Perdido **sem validar os campos obrigatórios** configurados no sistema. Esta é uma inconsistência com o Pipeline principal, que já possui essa validação.

### Código Atual (sem validação)

**ZappCRMPanel.tsx (linha 624-628)**:
```tsx
onClick={() => {
  if (!isActive) {
    moveDeal.mutate({ dealId: activeDeal.id, stageId: stage.id });
  }
}}
```

**ZappDealDetailSheet.tsx (linha 516)**:
```tsx
onClick={() => !isActive && moveDeal.mutate(stage.id)}
```

**ZappDealDetailSheet.tsx (linhas 420, 430)**:
```tsx
onClick={() => updateDealStatus.mutate("won")}
onClick={() => updateDealStatus.mutate("lost")}
```

---

## Solução Proposta

Integrar o hook `useRequiredFieldsValidation` e o componente `RequiredFieldsModal` em ambos os componentes do ROY zAPP, seguindo o mesmo padrão já implementado no Pipeline.

### Fluxo de Validação

1. Usuário clica em uma etapa ou botão (Ganho/Perdido)
2. Sistema executa `validateDealMove` ou `validateDealOutcome`
3. Se houver campos faltando → Abre `RequiredFieldsModal`
4. Após preenchimento → Executa a ação (mover etapa ou mudar status)
5. Se não houver campos faltando → Executa a ação diretamente

---

## Alterações Técnicas

### 1. ZappCRMPanel.tsx

**Novos imports:**
```tsx
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
```

**Novos estados:**
```tsx
const [requiredFieldsModal, setRequiredFieldsModal] = useState<{
  open: boolean;
  dealId: string;
  dealTitle: string;
  targetStageId: string;
  targetStageName: string;
  missingFields: CustomField[];
} | null>(null);
```

**Novo handler com validação:**
```tsx
const handleStageClick = async (stageId: string, stageName: string) => {
  if (!activeDeal || !currentUser?.account_id) return;
  
  const { validateDealMove } = useRequiredFieldsValidation();
  const result = await validateDealMove(activeDeal.id, stageId, currentUser.account_id);
  
  if (!result.canMoveToStage) {
    setRequiredFieldsModal({
      open: true,
      dealId: activeDeal.id,
      dealTitle: activeDeal.title,
      targetStageId: stageId,
      targetStageName: stageName,
      missingFields: result.missingFields,
    });
  } else {
    moveDeal.mutate({ dealId: activeDeal.id, stageId });
  }
};
```

**Substituir onClick direto (linha 624-628):**
```tsx
// Antes:
onClick={() => {
  if (!isActive) {
    moveDeal.mutate({ dealId: activeDeal.id, stageId: stage.id });
  }
}}

// Depois:
onClick={() => !isActive && handleStageClick(stage.id, stage.name)}
```

**Adicionar modal ao final do componente:**
```tsx
{requiredFieldsModal && (
  <RequiredFieldsModal
    open={requiredFieldsModal.open}
    onOpenChange={(open) => !open && setRequiredFieldsModal(null)}
    dealId={requiredFieldsModal.dealId}
    dealTitle={requiredFieldsModal.dealTitle}
    targetStageName={requiredFieldsModal.targetStageName}
    missingFields={requiredFieldsModal.missingFields}
    accountId={currentUser?.account_id || ""}
    onComplete={() => {
      moveDeal.mutate({ 
        dealId: requiredFieldsModal.dealId, 
        stageId: requiredFieldsModal.targetStageId 
      });
      setRequiredFieldsModal(null);
    }}
  />
)}
```

---

### 2. ZappDealDetailSheet.tsx

**Novos imports:**
```tsx
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
```

**Novos estados:**
```tsx
const [requiredFieldsModal, setRequiredFieldsModal] = useState<{
  open: boolean;
  dealId: string;
  dealTitle: string;
  targetStageId?: string;
  targetStageName: string;
  missingFields: CustomField[];
  outcomeType?: "won" | "lost";
} | null>(null);
```

**Instanciar hook:**
```tsx
const { validateDealMove, validateDealOutcome } = useRequiredFieldsValidation();
```

**Novo handler para mudança de etapa (linha 516):**
```tsx
const handleStageClick = async (stageId: string, stageName: string) => {
  if (!deal || !currentUser?.account_id) return;
  
  const result = await validateDealMove(dealId, stageId, currentUser.account_id);
  
  if (!result.canMoveToStage) {
    setRequiredFieldsModal({
      open: true,
      dealId: dealId,
      dealTitle: deal.title,
      targetStageId: stageId,
      targetStageName: stageName,
      missingFields: result.missingFields,
    });
  } else {
    moveDeal.mutate(stageId);
  }
};
```

**Novo handler para Ganho/Perdido (linhas 420, 430):**
```tsx
const handleOutcomeClick = async (outcome: "won" | "lost") => {
  if (!deal || !currentUser?.account_id) return;
  
  const result = await validateDealOutcome(dealId, outcome, currentUser.account_id);
  
  if (!result.canMoveToStage) {
    setRequiredFieldsModal({
      open: true,
      dealId: dealId,
      dealTitle: deal.title,
      targetStageName: outcome === "won" ? "Ganho" : "Perdido",
      missingFields: result.missingFields,
      outcomeType: outcome,
    });
  } else {
    updateDealStatus.mutate(outcome);
  }
};
```

**Substituir onClick dos botões Ganho/Perdido:**
```tsx
// Antes (linha 420):
onClick={() => updateDealStatus.mutate("won")}

// Depois:
onClick={() => handleOutcomeClick("won")}

// Antes (linha 430):
onClick={() => updateDealStatus.mutate("lost")}

// Depois:
onClick={() => handleOutcomeClick("lost")}
```

**Adicionar modal dentro do SheetContent:**
```tsx
{requiredFieldsModal && (
  <RequiredFieldsModal
    open={requiredFieldsModal.open}
    onOpenChange={(open) => !open && setRequiredFieldsModal(null)}
    dealId={requiredFieldsModal.dealId}
    dealTitle={requiredFieldsModal.dealTitle}
    targetStageName={requiredFieldsModal.targetStageName}
    missingFields={requiredFieldsModal.missingFields}
    accountId={currentUser?.account_id || ""}
    outcomeType={requiredFieldsModal.outcomeType}
    onComplete={() => {
      if (requiredFieldsModal.outcomeType) {
        updateDealStatus.mutate(requiredFieldsModal.outcomeType);
      } else if (requiredFieldsModal.targetStageId) {
        moveDeal.mutate(requiredFieldsModal.targetStageId);
      }
      setRequiredFieldsModal(null);
    }}
  />
)}
```

---

## Arquivos a Serem Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/components/royzapp/ZappCRMPanel.tsx` | Adicionar validação na movimentação de etapas |
| `src/components/royzapp/ZappDealDetailSheet.tsx` | Adicionar validação em etapas e botões Ganho/Perdido |

---

## Resultado Esperado

1. **Ao clicar em uma etapa** no ROY zAPP:
   - Se houver campos obrigatórios não preenchidos → Abre modal
   - Se todos os campos estiverem preenchidos → Move normalmente

2. **Ao clicar em "Ganho" ou "Perdido"**:
   - Valida campos obrigatórios configurados para esse desfecho
   - Se faltar campos → Abre modal com mensagem contextual
   - Após preenchimento → Executa a ação

3. **Experiência consistente** entre Pipeline e ROY zAPP

