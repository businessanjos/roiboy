
# Plano: Adicionar Opção de Campo Obrigatório para Ganho/Perdido

## Resumo

Atualmente, os campos personalizados de negócios podem ser configurados como obrigatórios para etapas específicas do pipeline. O usuário quer estender essa funcionalidade para também incluir as ações de "Ganho" (won) e "Perdido" (lost) como pontos de validação.

## Arquitetura Atual

O sistema já possui:
1. **Campo `required_stages`** na tabela `custom_fields` (JSON array)
2. **Hook `useRequiredFieldsValidation`** que valida campos ao mover deals entre etapas
3. **Componente `RequiredFieldsModal`** que exibe campos faltantes e permite preenchê-los
4. **UI de seleção de etapas** no `CustomFieldsManager.tsx` (checkboxes para etapas do pipeline)

## Solução Proposta

Estender o sistema existente para incluir "won" e "lost" como identificadores especiais no array `required_stages`, sem necessidade de mudanças no schema do banco.

### Mudanças no `CustomFieldsManager.tsx`

1. Adicionar checkboxes para "Ao dar Ganho" e "Ao dar Perdido" na lista de etapas:

```text
Obrigatório em quais etapas?
├── ☑ Todas as etapas
├── ☐ Chegou Lead
├── ☐ Contato Realizado
├── ☐ Em Qualificação
├── ...
├── ☐ Follow Up
├── ── separador visual ──
├── ☐ Ao dar Ganho    ← NOVO
└── ☐ Ao dar Perdido  ← NOVO
```

2. Quando "Todas as etapas" está marcado:
   - Continua funcionando como antes (aplica a todas as etapas de pipeline)
   - **Não** marca automaticamente "Ao dar Ganho" e "Ao dar Perdido"
   - Os checkboxes de "Ao dar Ganho" e "Ao dar Perdido" ficam independentes

3. Os valores "won" e "lost" serão armazenados no array `required_stages` junto com os IDs das etapas.

### Mudanças no `useRequiredFieldsValidation.tsx`

1. Criar nova função `validateDealOutcome(dealId, outcome, accountId)`:
   - `outcome` pode ser `"won"` ou `"lost"`
   - Filtra campos onde `required_stages` inclui `"won"` ou `"lost"`
   - Retorna campos faltantes da mesma forma que `validateDealMove`

2. Manter `validateDealMove` inalterado para etapas normais.

### Mudanças no `SalesPipeline.tsx`

1. No `handleMarkAsWon`:
   - Antes de prosseguir, chamar `validateDealOutcome(dealId, "won", accountId)`
   - Se houver campos faltantes, abrir `RequiredFieldsModal`
   - Só prosseguir com a conversão após preenchimento

2. No `markAsLost` (no hook `useDeals` ou diretamente no componente):
   - Aplicar a mesma lógica de validação para campos obrigatórios ao perder

### Mudanças no `DealDialog.tsx`

1. O botão "Ganhar" e "Perder" precisam interceptar a ação para validar campos antes de prosseguir.
2. Integrar o `RequiredFieldsModal` no fluxo do dialog.

### Mudanças no `RequiredFieldsModal.tsx`

1. Adicionar prop opcional `outcomeName` para exibir mensagem contextual:
   - "Para marcar como Ganha" ou "Para marcar como Perdida"
   - Manter compatibilidade com uso atual (mover entre etapas)

## Detalhes Técnicos

### Estrutura do `required_stages` (sem mudanças no schema)

```json
// Exemplo 1: Obrigatório apenas ao dar ganho
["won"]

// Exemplo 2: Obrigatório ao perder e em etapa específica  
["lost", "uuid-da-etapa-follow-up"]

// Exemplo 3: Todas as etapas + ganho + perdido
["all", "won", "lost"]

// Exemplo 4: Apenas etapas específicas
["uuid-etapa-1", "uuid-etapa-2"]
```

### UI no CustomFieldsManager (detalhamento)

```tsx
{/* Stage selector for required fields - only for deals context */}
{isRequired && sectorContext === "deals" && dealStages.length > 0 && (
  <div className="space-y-2 pl-3 border-l-2 border-primary/20 ml-1">
    <Label className="text-sm text-muted-foreground">
      Obrigatório em quais etapas?
    </Label>
    <div className="space-y-2">
      {/* "All stages" option */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="stage-all" ... />
        <label>Todas as etapas</label>
      </div>
      
      {/* Individual stages (hidden when "all" selected) */}
      {!requiredStages.includes("all") && dealStages.map(stage => (...))}
      
      {/* Separator */}
      <div className="border-t my-2" />
      
      {/* Won option - NEW */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="stage-won"
          checked={requiredStages.includes("won")}
          onChange={(e) => {
            if (e.target.checked) {
              setRequiredStages(prev => [...prev.filter(s => s !== "all"), "won"]);
            } else {
              setRequiredStages(prev => prev.filter(id => id !== "won"));
            }
          }}
        />
        <label htmlFor="stage-won" className="text-sm cursor-pointer flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5 text-emerald-500" />
          Ao dar Ganho
        </label>
      </div>
      
      {/* Lost option - NEW */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="stage-lost"
          checked={requiredStages.includes("lost")}
          onChange={...}
        />
        <label htmlFor="stage-lost" className="text-sm cursor-pointer flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5 text-red-500" />
          Ao dar Perdido
        </label>
      </div>
    </div>
  </div>
)}
```

### Nova função no hook de validação

```tsx
// Em useRequiredFieldsValidation.tsx
const validateDealOutcome = async (
  dealId: string,
  outcome: "won" | "lost",
  accountId: string
): Promise<RequiredFieldValidation> => {
  // Fetch required custom fields for deals
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
  
  // Filter fields required for this outcome
  const requiredForOutcome = fields.filter(field => {
    const stages = field.required_stages as string[] | null;
    if (!stages || stages.length === 0) return false;
    return stages.includes(outcome);
  });
  
  // ... rest of validation logic (same as validateDealMove)
};

return { validateDealMove, validateDealOutcome };
```

## Arquivos a Modificar

1. **`src/components/custom-fields/CustomFieldsManager.tsx`**
   - Adicionar checkboxes "Ao dar Ganho" e "Ao dar Perdido" na UI
   - Ajustar lógica de seleção para permitir combinações

2. **`src/hooks/useRequiredFieldsValidation.tsx`**
   - Adicionar função `validateDealOutcome`
   - Exportar nova função junto com `validateDealMove`

3. **`src/pages/SalesPipeline.tsx`**
   - Integrar validação no `handleMarkAsWon`
   - Adicionar estado para controlar o modal de campos obrigatórios no fluxo won/lost
   - Criar handler similar para `handleMarkAsLost`

4. **`src/components/sales/DealDialog.tsx`**
   - Integrar validação nos botões "Ganhar" e "Perder"
   - Adicionar `RequiredFieldsModal` ao componente

5. **`src/components/sales/RequiredFieldsModal.tsx`**
   - Tornar a mensagem do dialog mais flexível (etapa vs. ganho/perdido)
   - Adicionar prop opcional para customizar o texto

## Impacto

- **Usuários**: Poderão configurar campos como obrigatórios ao fechar negócios
- **Dados**: Maior qualidade de dados capturados antes de marcar como ganho
- **Fluxo**: Validação impede fechamento sem informações críticas (ex: "Valor Recebido da Venda")
