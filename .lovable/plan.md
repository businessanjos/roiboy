
# Plano: Isolamento de Campos Personalizados por Setor

## Diagnóstico do Problema

O problema identificado é que o `CustomFieldsManager` usado no setor de Vendas (Pipeline) está buscando **todos os campos ativos** da conta, incluindo os campos criados no setor de Operações. A causa raiz:

| Componente | Localização | Comportamento Atual |
|------------|-------------|---------------------|
| `CustomFieldsManager` | Operações (Clientes) | Busca todos campos onde `is_active = true` |
| `LeadCustomFieldsManager` | Vendas (Leads) | Filtra por `show_in_leads = true` |
| `SalesPipeline` > "Campos" | Vendas (Pipeline) | Usa `CustomFieldsManager` genérico (problema!) |

---

## Solução Proposta

Adicionar uma **propriedade `sectorContext`** ao `CustomFieldsManager` que define qual coluna de visibilidade deve ser usada para filtrar e configurar os campos.

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CustomFieldsManager                          │
│                                                                 │
│  Props:                                                        │
│  ├─ sectorContext: "clients" | "deals" | "leads"               │
│  │                                                              │
│  Comportamento baseado em sectorContext:                        │
│  ├─ "clients" → filtrar por show_in_clients                    │
│  ├─ "deals"   → filtrar por show_in_deals                      │
│  └─ "leads"   → filtrar por show_in_leads                      │
│                                                                 │
│  Ao criar/editar campo:                                         │
│  ├─ Define a flag do contexto atual como TRUE                  │
│  └─ Mantém as outras flags como FALSE (se for novo campo)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Modificar CustomFieldsManager

Adicionar prop `sectorContext` e ajustar a lógica de busca e salvamento:

```typescript
// Novas props
interface CustomFieldsManagerProps {
  onFieldsChange?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sectorContext?: "clients" | "deals" | "leads"; // NOVO
}

// Valor padrão para manter retrocompatibilidade
const sectorContext = props.sectorContext ?? "clients";
```

### 1.1 Ajustar fetchFields()

```typescript
const fetchFields = async () => {
  if (!currentUser?.account_id) return;

  // Determinar a coluna de filtro baseado no contexto
  const visibilityColumn = 
    sectorContext === "clients" ? "show_in_clients" :
    sectorContext === "deals" ? "show_in_deals" :
    "show_in_leads";

  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("account_id", currentUser.account_id)
    .eq("is_active", true)
    .eq(visibilityColumn, true) // Filtrar pelo contexto do setor
    .order("display_order");
    
  // ... resto do código
};
```

### 1.2 Ajustar handleSave()

Ao criar um novo campo, definir apenas a flag do contexto atual como `true`:

```typescript
const fieldData = {
  account_id: currentUser.account_id,
  name: name.trim(),
  field_type: fieldType,
  options: needsOpts ? validOptions : [],
  is_required: isRequired,
  display_order: editingField?.display_order ?? fields.length,
  // Definir visibilidade baseada no contexto
  show_in_clients: sectorContext === "clients",
  show_in_deals: sectorContext === "deals",
  show_in_leads: sectorContext === "leads",
};
```

### 1.3 Atualizar título do diálogo

Mostrar claramente qual setor está sendo configurado:

```typescript
const sectorTitle = 
  sectorContext === "clients" ? "Campos de Clientes (Operações)" :
  sectorContext === "deals" ? "Campos de Negócios (Vendas)" :
  "Campos de Leads (Vendas)";

// No DialogHeader
<DialogTitle>Configurar {sectorTitle}</DialogTitle>
```

---

## Etapa 2: Atualizar SalesPipeline

Passar o contexto correto ao abrir o gerenciador de campos:

```typescript
// Em src/pages/SalesPipeline.tsx
<CustomFieldsManager
  open={isFieldsDialogOpen}
  onOpenChange={setIsFieldsDialogOpen}
  sectorContext="deals" // NOVO: Contexto de Vendas/Negócios
/>
```

---

## Etapa 3: Verificar Uso Existente em Operações

Garantir que o `CustomFieldsManager` em páginas de Operações (Clientes) use o contexto correto:

| Arquivo | Uso | Contexto |
|---------|-----|----------|
| `ClientFieldsSummary.tsx` | Gerenciar campos de cliente | `sectorContext="clients"` |
| `ClientDetail.tsx` | Campos do cliente | `sectorContext="clients"` |
| `SalesPipeline.tsx` | Campos de negócios | `sectorContext="deals"` |

---

## Etapa 4: Remover Toggle "Exibir em Clientes"

Atualmente o `CustomFieldsManager` tem um toggle `showInClients` que permite ao usuário escolher se o campo aparece em clientes. Com a nova arquitetura:

- **Remover o toggle** da interface
- **A visibilidade é definida automaticamente** pelo contexto do setor onde o campo foi criado
- Se o usuário quiser um campo em múltiplos setores, pode criá-lo em cada setor separadamente ou usar uma configuração avançada (futura)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/custom-fields/CustomFieldsManager.tsx` | Adicionar prop `sectorContext`, ajustar `fetchFields()` e `handleSave()` |
| `src/pages/SalesPipeline.tsx` | Passar `sectorContext="deals"` ao `CustomFieldsManager` |
| `src/components/client/ClientFieldsSummary.tsx` | Garantir `sectorContext="clients"` (se aplicável) |

---

## Resultado Esperado

| Setor | Localização | Campos Visíveis |
|-------|-------------|-----------------|
| Operações | `/clients/:id` | Apenas campos com `show_in_clients = true` |
| Vendas (Pipeline) | `/pipeline` > Campos | Apenas campos com `show_in_deals = true` |
| Vendas (Leads) | Leads > Campos | Apenas campos com `show_in_leads = true` |

Cada setor terá sua própria lista isolada de campos personalizados, sem sobreposição.

---

## Detalhes Técnicos

### Mapeamento de Contexto para Coluna

```typescript
const SECTOR_COLUMN_MAP = {
  clients: "show_in_clients",
  deals: "show_in_deals", 
  leads: "show_in_leads",
} as const;

type SectorContext = keyof typeof SECTOR_COLUMN_MAP;
```

### Retrocompatibilidade

O valor padrão `sectorContext = "clients"` garante que usos existentes do componente continuem funcionando sem modificações.
