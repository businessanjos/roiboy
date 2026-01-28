

# Plano: Isolar Campos Personalizados por Setor

## Problema Identificado

Campos personalizados criados em um setor (ex: Operações) estão aparecendo em outros setores (ex: Vendas) porque:

1. **Bug no código de salvamento** (linha 547 do `CustomFieldsManager.tsx`):
   ```typescript
   // ERRADO - usa show_in_clients para definir show_in_deals
   show_in_deals: editingField ? editingField.show_in_clients : sectorContext === "deals",
   
   // TAMBÉM ERRADO - sempre define false ao editar
   show_in_leads: editingField ? false : sectorContext === "leads",
   ```

2. **Ausência de isolamento real**: O sistema usa flags booleanas (`show_in_clients`, `show_in_deals`, `show_in_leads`) que podem ser todas `true` simultaneamente, permitindo que um campo apareça em múltiplos setores.

3. **Dados corrompidos no banco**: Existem campos que foram salvos com flags incorretas, causando o cruzamento entre setores.

## Solução Proposta

### Parte 1: Corrigir o Bug no Código

Arquivo: `src/components/custom-fields/CustomFieldsManager.tsx`

**Mudança nas linhas 544-552:**

```typescript
// ANTES (bugado)
show_in_clients: editingField ? showInClients : sectorContext === "clients",
show_in_deals: editingField ? editingField.show_in_clients : sectorContext === "deals",
show_in_leads: editingField ? false : sectorContext === "leads",

// DEPOIS (correto)
// For new fields: only enable the current sector's flag
// For editing: preserve all flags from the existing field
show_in_clients: editingField?.show_in_clients ?? (sectorContext === "clients"),
show_in_deals: editingField?.show_in_deals ?? (sectorContext === "deals"),
show_in_leads: editingField?.show_in_leads ?? (sectorContext === "leads"),
```

**Problema adicional no mapeamento de campos** (linhas 291-301):

O campo `show_in_deals` não é mapeado quando os campos são carregados, impedindo que o valor correto seja preservado ao editar. Corrigir:

```typescript
const mappedFields: CustomField[] = data.map(f => ({
  id: f.id,
  name: f.name,
  field_type: f.field_type as CustomField["field_type"],
  options: (f.options as unknown as FieldOption[]) || [],
  is_required: f.is_required,
  display_order: f.display_order,
  is_active: f.is_active,
  show_in_clients: f.show_in_clients,
  show_in_deals: f.show_in_deals,      // ADICIONAR
  show_in_leads: f.show_in_leads,      // ADICIONAR
  folder_id: f.folder_id,
}));
```

**Atualizar a interface CustomField** para incluir os campos:

```typescript
export interface CustomField {
  // ... existing fields
  show_in_clients?: boolean;
  show_in_deals?: boolean;    // ADICIONAR
  show_in_leads?: boolean;    // ADICIONAR
}
```

### Parte 2: Limpar Dados Corrompidos no Banco

Executar SQL para corrigir campos que estão marcados para múltiplos setores incorretamente:

**Campos que devem ser APENAS de Clientes (Operações):**
```sql
UPDATE custom_fields 
SET show_in_deals = false, show_in_leads = false 
WHERE show_in_clients = true 
  AND (show_in_deals = true OR show_in_leads = true)
  AND name NOT IN ('Canal de Venda', 'Faturamento Atual', 'Origem da Venda', ...); -- campos conhecidos de Vendas
```

**Campos que devem ser APENAS de Deals (Vendas):**
```sql
UPDATE custom_fields 
SET show_in_clients = false, show_in_leads = false 
WHERE show_in_deals = true 
  AND (show_in_clients = true OR show_in_leads = true)
  AND name IN ('Canal de Venda', 'Faturamento Atual', 'Origem da Venda', ...); -- campos de Vendas
```

**Nota**: Antes de executar, verificar com o usuário quais campos pertencem a qual setor.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/custom-fields/CustomFieldsManager.tsx` | Corrigir bug nas linhas 544-552 e adicionar mapeamento correto |
| Banco de dados | Limpar dados incorretos (via SQL) |

## Resultado Esperado

1. Campos criados em Operações (`show_in_clients`) **não** aparecerão em Vendas
2. Campos criados em Vendas (`show_in_deals`) **não** aparecerão em Operações
3. Editar um campo preservará suas flags de setor corretamente
4. Campos existentes com flags incorretas serão corrigidos

## Impacto

- Correção de bug crítico que causava vazamento de dados entre setores
- Limpeza de dados históricos incorretos
- Isolamento correto por setor daqui em diante

