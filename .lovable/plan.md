
# Plano: Correção de Isolamento de Campos por Setor e Formatação de Texto em Formulários

## Problemas Identificados

### Problema 1: Campos de Vendas aparecendo em Formulários de Operações

**Causa Raiz:**
- A função `fetchCustomFields` em `src/pages/Forms.tsx` (linha 744-757) busca TODOS os campos personalizados ativos sem filtrar por setor
- Isso permite que usuários selecionem campos de Vendas (como "Canal de Venda", "Item da Venda") ao criar formulários de Operações
- O formulário "Cadastro Empresarial" foi identificado com campos de Vendas incorretamente incluídos

**Campos incorretos encontrados:**
- `Canal de Venda` (show_in_deals: true) - Campo exclusivo de Vendas
- `Item da Venda` (show_in_deals: true) - Campo exclusivo de Vendas

### Problema 2: Texto branco em fundo claro nos campos de formulário

**Causa Raiz:**
- Em `src/pages/PublicForm.tsx`, os Labels dentro de RadioGroup (linha 253-258) e Checkbox (linha 288-289) não aplicam a cor de texto do appearance
- Eles usam apenas `className="font-normal cursor-pointer"` sem o `style={{ color: appearance.text_color }}`
- Quando o fundo do card é claro e a cor de texto padrão é clara, o texto fica invisível

---

## Soluções Propostas

### Correção 1: Implementar Isolamento de Campos por Setor no Editor de Formulários

**Arquivo:** `src/pages/Forms.tsx`

**Mudança na função `fetchCustomFields`:**
```typescript
// ANTES (linha 744-757):
const fetchCustomFields = async () => {
  const { data, error } = await supabase
    .from("custom_fields")
    .select("id, name, field_type, options, is_required")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  // ...
};

// DEPOIS:
const fetchCustomFields = async () => {
  // Buscar campos que são show_in_clients=true (padrão para formulários CX)
  // OU campos que não pertencem exclusivamente a deals/leads
  const { data, error } = await supabase
    .from("custom_fields")
    .select("id, name, field_type, options, is_required, show_in_clients, show_in_deals, show_in_leads")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  
  if (error) throw error;
  
  // Filtrar apenas campos que:
  // 1. São visíveis em clientes (show_in_clients = true), OU
  // 2. Não são exclusivos de deals/leads (campos genéricos)
  const filteredFields = (data || []).filter(field => 
    field.show_in_clients === true || 
    (!field.show_in_deals && !field.show_in_leads)
  );
  
  setCustomFields(filteredFields);
};
```

**Lógica:**
- Campos com `show_in_deals = true` E `show_in_clients = false` são exclusivos de Vendas (Pipeline)
- Campos com `show_in_leads = true` E `show_in_clients = false` são exclusivos de Leads
- Formulários CX devem mostrar apenas campos genéricos ou campos de clientes

### Correção 2: Aplicar Cor de Texto aos Labels de Opções

**Arquivo:** `src/pages/PublicForm.tsx`

**Mudança no renderField para select (linhas 253-258):**
```tsx
// ANTES:
<Label
  htmlFor={`${field.id}-${opt.value}`}
  className="font-normal cursor-pointer"
>
  {opt.label}
</Label>

// DEPOIS:
<Label
  htmlFor={`${field.id}-${opt.value}`}
  className="font-normal cursor-pointer"
  style={{ color: appearance.text_color }}
>
  {opt.label}
</Label>
```

**Mudança no renderField para multi_select (linhas 288-289):**
```tsx
// ANTES:
<Label
  htmlFor={`${field.id}-${opt.value}`}
  className="font-normal cursor-pointer"
>
  {opt.label}
</Label>

// DEPOIS:
<Label
  htmlFor={`${field.id}-${opt.value}`}
  className="font-normal cursor-pointer"
  style={{ color: appearance.text_color }}
>
  {opt.label}
</Label>
```

### Correção 3: Limpar Campos Incorretos do Formulário Existente (Migração SQL)

**Ação:** Remover os campos de Vendas do formulário "Cadastro Empresarial"

```sql
-- Remover campos de Vendas do formulário de Operações
UPDATE forms 
SET fields = array_remove(array_remove(fields, '16ebda9f-cd3b-412c-bb06-0950001963c5'), '033b91fb-3add-4c96-aec9-567fefbd0fb2')
WHERE id = 'f53653f9-85b3-4f42-8b86-57cecb553330';
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Forms.tsx` | Filtrar campos por setor em `fetchCustomFields` |
| `src/pages/PublicForm.tsx` | Adicionar `style={{ color: appearance.text_color }}` aos Labels de opções |
| Migração SQL | Remover campos de Vendas do formulário "Cadastro Empresarial" |

---

## Resumo Técnico

1. **fetchCustomFields** passará a filtrar campos excluindo aqueles exclusivos de Deals/Leads
2. **renderField** passará a propagar a cor de texto para todas as labels de opções
3. **Migração SQL** limpará os campos incorretos já inseridos no formulário afetado

## Impacto Esperado

- Campos de Vendas não aparecerão mais na seleção de formulários CX/Operações
- Texto dos campos de formulário sempre terá contraste adequado
- Formulário "Cadastro Empresarial" não mostrará mais "Canal de Venda" e "Item da Venda"
