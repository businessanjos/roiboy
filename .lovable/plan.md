
# Plano: Campos Obrigatórios por Etapa do Pipeline

## Visão Geral

Implementar validação de campos personalizados obrigatórios baseada na etapa do pipeline, bloqueando a movimentação de negócios quando campos obrigatórios da etapa de destino não estiverem preenchidos.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE MOVIMENTAÇÃO DE NEGÓCIO                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  1. Vendedor arrasta negócio para nova etapa (DealKanban)       │
    └─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  2. Verificar campos obrigatórios para etapa de destino         │
    │     - Buscar campos com required_stages contendo "all" ou       │
    │       a etapa de destino                                        │
    │     - Verificar quais não possuem valor preenchido              │
    └─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
    ┌─────────────────────────────┐   ┌─────────────────────────────┐
    │  TODOS PREENCHIDOS          │   │  CAMPOS VAZIOS              │
    │  --> Mover normalmente      │   │  --> Abrir modal de         │
    │                             │   │      preenchimento          │
    └─────────────────────────────┘   └─────────────────────────────┘
                                                    │
                                                    ▼
                                      ┌─────────────────────────────┐
                                      │  3. Usuário preenche campos │
                                      │     obrigatórios no modal   │
                                      └─────────────────────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │                               │
                                    ▼                               ▼
                    ┌─────────────────────────────┐   ┌─────────────────────────────┐
                    │  PREENCHIDO E SALVO         │   │  CANCELOU                   │
                    │  --> Mover negócio          │   │  --> Negócio permanece na   │
                    │                             │   │      etapa atual            │
                    └─────────────────────────────┘   └─────────────────────────────┘
```

---

## Etapa 1: Alteração no Banco de Dados

Adicionar coluna para armazenar as etapas onde o campo é obrigatório:

```sql
-- Adicionar coluna para armazenar etapas onde o campo é obrigatório
ALTER TABLE public.custom_fields 
ADD COLUMN IF NOT EXISTS required_stages JSONB DEFAULT '["all"]';

-- A estrutura será:
-- ["all"] = obrigatório em todas as etapas (padrão)
-- ["stage_id_1", "stage_id_2"] = obrigatório apenas nessas etapas específicas
-- [] = não obrigatório (is_required seria false neste caso)
```

---

## Etapa 2: Modificar CustomFieldsManager

### 2.1 Adicionar Estado e Fetch de Etapas

Quando o contexto for "deals", buscar as etapas do pipeline para exibir como opções:

```typescript
// Novos estados
const [dealStages, setDealStages] = useState<{id: string, name: string}[]>([]);
const [requiredStages, setRequiredStages] = useState<string[]>(["all"]);

// Buscar etapas quando contexto for deals
useEffect(() => {
  if (sectorContext === "deals" && currentUser?.account_id) {
    supabase
      .from("deal_stages")
      .select("id, name")
      .eq("account_id", currentUser.account_id)
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        if (data) setDealStages(data);
      });
  }
}, [sectorContext, currentUser?.account_id]);
```

### 2.2 Atualizar UI do Formulário

Adicionar seletor de etapas que aparece apenas quando "Obrigatório" está marcado:

```typescript
{/* Switch de Obrigatório */}
<div className="flex items-center justify-between pt-2">
  <div>
    <Label className="text-sm">Obrigatório</Label>
    <p className="text-xs text-muted-foreground">Campo deve ser preenchido</p>
  </div>
  <Switch checked={isRequired} onCheckedChange={setIsRequired} />
</div>

{/* Seletor de etapas obrigatórias - aparece só quando isRequired = true e contexto = deals */}
{isRequired && sectorContext === "deals" && dealStages.length > 0 && (
  <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-2">
    <Label className="text-sm">Obrigatório em quais etapas?</Label>
    <div className="space-y-2">
      {/* Opção "Todas" */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={requiredStages.includes("all")}
          onCheckedChange={(checked) => {
            if (checked) {
              setRequiredStages(["all"]);
            } else {
              setRequiredStages([]);
            }
          }}
        />
        <span className="text-sm font-medium">Todas as etapas</span>
      </div>
      
      {/* Etapas individuais (desabilitadas se "Todas" estiver marcada) */}
      {!requiredStages.includes("all") && dealStages.map(stage => (
        <div key={stage.id} className="flex items-center gap-2 pl-4">
          <Checkbox
            checked={requiredStages.includes(stage.id)}
            onCheckedChange={(checked) => {
              setRequiredStages(prev => 
                checked 
                  ? [...prev, stage.id]
                  : prev.filter(id => id !== stage.id)
              );
            }}
          />
          <span className="text-sm">{stage.name}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

### 2.3 Atualizar handleSave

Incluir `required_stages` nos dados salvos:

```typescript
const fieldData = {
  // ... campos existentes
  is_required: isRequired,
  required_stages: isRequired && sectorContext === "deals" 
    ? requiredStages 
    : null,
};
```

---

## Etapa 3: Criar Hook de Validação

Novo hook para verificar campos obrigatórios pendentes:

```typescript
// src/hooks/useRequiredFieldsValidation.tsx

interface RequiredFieldValidation {
  canMoveToStage: boolean;
  missingFields: CustomField[];
}

export function useRequiredFieldsValidation() {
  const validateDealMove = async (
    dealId: string,
    targetStageId: string,
    accountId: string
  ): Promise<RequiredFieldValidation> => {
    
    // 1. Buscar campos obrigatórios para a etapa de destino
    const { data: fields } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("account_id", accountId)
      .eq("show_in_deals", true)
      .eq("is_active", true)
      .eq("is_required", true);
    
    if (!fields || fields.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 2. Filtrar campos que são obrigatórios para esta etapa
    const requiredForStage = fields.filter(field => {
      const stages = field.required_stages as string[] | null;
      if (!stages || stages.length === 0) return false;
      return stages.includes("all") || stages.includes(targetStageId);
    });
    
    if (requiredForStage.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 3. Buscar valores preenchidos para o negócio
    const { data: values } = await supabase
      .from("deal_field_values")
      .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
      .eq("deal_id", dealId);
    
    const filledFieldIds = new Set(
      (values || [])
        .filter(v => 
          v.value_text !== null || 
          v.value_number !== null || 
          v.value_boolean !== null ||
          v.value_date !== null ||
          v.value_json !== null
        )
        .map(v => v.field_id)
    );
    
    // 4. Identificar campos não preenchidos
    const missingFields = requiredForStage.filter(
      field => !filledFieldIds.has(field.id)
    );
    
    return {
      canMoveToStage: missingFields.length === 0,
      missingFields,
    };
  };
  
  return { validateDealMove };
}
```

---

## Etapa 4: Criar Modal de Preenchimento

Novo componente para exibir e preencher campos obrigatórios faltantes:

```typescript
// src/components/sales/RequiredFieldsModal.tsx

interface RequiredFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealTitle: string;
  targetStageName: string;
  missingFields: CustomField[];
  accountId: string;
  onComplete: () => void;
}

export function RequiredFieldsModal({
  open,
  onOpenChange,
  dealId,
  dealTitle,
  targetStageName,
  missingFields,
  accountId,
  onComplete,
}: RequiredFieldsModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  
  const allFieldsFilled = missingFields.every(field => {
    const value = values[field.id];
    if (field.field_type === "boolean") return value !== undefined;
    return value !== null && value !== undefined && value !== "";
  });
  
  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvar todos os valores
      for (const field of missingFields) {
        const value = values[field.id];
        if (value === undefined || value === null) continue;
        
        const valueData = {
          account_id: accountId,
          deal_id: dealId,
          field_id: field.id,
          value_text: field.field_type === "text" || field.field_type === "select" ? value : null,
          value_number: field.field_type === "number" || field.field_type === "currency" ? value : null,
          value_boolean: field.field_type === "boolean" ? value : null,
          value_date: field.field_type === "date" ? value : null,
          value_json: ["multi_select", "user", "location"].includes(field.field_type) ? value : null,
        };
        
        await supabase
          .from("deal_field_values")
          .upsert(valueData, { onConflict: "deal_id,field_id" });
      }
      
      toast.success("Campos preenchidos!");
      onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar campos");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Campos Obrigatórios</DialogTitle>
          <DialogDescription>
            Para mover "{dealTitle}" para a etapa "{targetStageName}", 
            preencha os campos abaixo:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {missingFields.map(field => (
            <div key={field.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {field.name} <span className="text-destructive">*</span>
              </Label>
              <DealFieldValueEditor
                field={field}
                dealId={dealId}
                accountId={accountId}
                currentValue={values[field.id]}
                onValueChange={(fieldId, value) => 
                  setValues(prev => ({ ...prev, [fieldId]: value }))
                }
              />
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!allFieldsFilled || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Preencher e Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Etapa 5: Integrar no DealKanban

Modificar o fluxo de movimentação para validar antes de mover:

```typescript
// Em DealKanban.tsx

const { validateDealMove } = useRequiredFieldsValidation();
const [requiredFieldsModal, setRequiredFieldsModal] = useState<{
  open: boolean;
  dealId: string;
  dealTitle: string;
  targetStageId: string;
  targetStageName: string;
  missingFields: CustomField[];
} | null>(null);

const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveDeal(null);

  if (!over) return;

  const dealId = active.id as string;
  const overId = over.id as string;

  const deal = deals.find(d => d.id === dealId);
  const targetStage = stages.find(s => s.id === overId) 
    || stages.find(s => s.id === deals.find(d => d.id === overId)?.stage_id);
  
  if (!deal || !targetStage || deal.stage_id === targetStage.id) return;

  // Validar campos obrigatórios
  const validation = await validateDealMove(dealId, targetStage.id, deal.account_id);
  
  if (!validation.canMoveToStage) {
    // Abrir modal para preencher campos faltantes
    setRequiredFieldsModal({
      open: true,
      dealId,
      dealTitle: deal.title,
      targetStageId: targetStage.id,
      targetStageName: targetStage.name,
      missingFields: validation.missingFields,
    });
    return;
  }
  
  // Mover normalmente
  await onDealMove(dealId, targetStage.id);
};

// No JSX, adicionar o modal
{requiredFieldsModal && (
  <RequiredFieldsModal
    open={requiredFieldsModal.open}
    onOpenChange={(open) => !open && setRequiredFieldsModal(null)}
    dealId={requiredFieldsModal.dealId}
    dealTitle={requiredFieldsModal.dealTitle}
    targetStageName={requiredFieldsModal.targetStageName}
    missingFields={requiredFieldsModal.missingFields}
    accountId={currentUser.account_id}
    onComplete={() => {
      onDealMove(requiredFieldsModal.dealId, requiredFieldsModal.targetStageId);
      setRequiredFieldsModal(null);
    }}
  />
)}
```

---

## Arquivos a Modificar/Criar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/[timestamp].sql` | Adicionar coluna `required_stages` à tabela `custom_fields` |
| `src/components/custom-fields/CustomFieldsManager.tsx` | Adicionar seletor de etapas obrigatórias quando `isRequired` está ativo |
| `src/hooks/useRequiredFieldsValidation.tsx` | **NOVO** - Hook para validar campos obrigatórios por etapa |
| `src/components/sales/RequiredFieldsModal.tsx` | **NOVO** - Modal para preenchimento de campos faltantes |
| `src/components/sales/DealKanban.tsx` | Integrar validação no `handleDragEnd` |
| `src/pages/SalesPipeline.tsx` | Passar props necessárias para o DealKanban |

---

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Campo obrigatório em "Todas" | Vendedor deve preencher antes de mover para qualquer etapa |
| Campo obrigatório em etapas específicas | Vendedor só precisa preencher quando mover para essas etapas |
| Campo não obrigatório | Nenhuma validação |
| Campos já preenchidos | Movimentação ocorre normalmente |
| Campos vazios obrigatórios | Modal abre solicitando preenchimento |
| Usuário cancela modal | Negócio permanece na etapa atual |
| Usuário preenche e confirma | Valores são salvos e negócio é movido |
