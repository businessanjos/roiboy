
# Plano: Campos Personalizados Individuais por Formulário

## Resumo do Problema

Atualmente, os campos personalizados (`custom_fields`) são **globais** - compartilhados entre todos os formulários e módulos do sistema (Clientes, Deals, Leads). Isso causa problemas como:

1. **Duplicação**: Campos criados via "Gerenciar Campos" de um formulário aparecem em outros formulários
2. **Poluição de dados**: Campos específicos de CX aparecem em Vendas e vice-versa
3. **Ordem inconsistente**: A ordem dos campos não é preservada corretamente por formulário

## Solução Proposta

Criar uma relação de **campos específicos por formulário** através de uma nova tabela intermediária que vincula campos a formulários individuais.

---

## Arquitetura da Solução

### Nova Tabela: `form_fields`

Cria uma relação many-to-many entre `forms` e `custom_fields`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| form_id | uuid | FK para forms |
| field_id | uuid | FK para custom_fields |
| display_order | integer | Ordem de exibição no formulário |
| created_at | timestamp | Data de criação |

### Lógica de Escopo

1. **Criação de campos**: Ao criar um campo em "Gerenciar Campos" de um formulário, ele será **exclusivo desse formulário**
2. **Listagem**: "Campos do Formulário" mostrará **apenas** campos vinculados a esse formulário específico
3. **Ordem**: A ordem vem de `form_fields.display_order`, não mais de `custom_fields.display_order`

---

## Fluxo Visual

```text
Formulário CX-001           Formulário CX-002
      |                           |
      v                           v
  form_fields                 form_fields
  (field_ids: A, B, C)        (field_ids: D, E)
      |                           |
      v                           v
  custom_fields              custom_fields
  A: "Nome Completo"         D: "CNPJ"
  B: "Data Nascimento"       E: "Razão Social"  
  C: "Animal Estimação"
```

---

## Alterações Necessárias

### 1. Migração de Banco de Dados

Criar tabela `form_fields`:

```sql
CREATE TABLE form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(form_id, field_id)
);

-- RLS policies
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
```

### 2. Novo Componente: `FormFieldsManager.tsx`

Um gerenciador de campos **específico para formulários**, diferente do `CustomFieldsManager` global:

- Cria campos novos que ficam automaticamente vinculados ao formulário atual
- Mostra apenas campos desse formulário
- Permite reordenar campos (atualiza `form_fields.display_order`)
- Permite excluir campos (remove da relação e opcionalmente do `custom_fields`)

### 3. Modificações em `Forms.tsx`

| Área | Mudança |
|------|---------|
| `fetchCustomFields()` | Buscar campos via `form_fields` filtrado por `form_id` |
| `selectedFields` | Derivar de `form_fields` em vez de `custom_fields` global |
| `handleSave()` | Salvar relação em `form_fields` com ordem correta |
| Botão "Gerenciar Campos" | Abrir `FormFieldsManager` passando `formId` |

### 4. Atualizar `CustomFieldsManager.tsx`

Adicionar prop opcional `formId`:
- Se `formId` estiver presente: modo exclusivo para formulário
- Se `formId` não estiver: modo global (atual - para Clientes/Deals/Leads)

---

## Fluxo do Usuário

```text
1. Usuário abre "Editar Formulário"
           |
           v
2. Clica em "Gerenciar Campos"
           |
           v
3. Vê apenas campos DESTE formulário
           |
           v
4. Cria novo campo "Profissão"
           |
           v
5. Campo salvo em:
   - custom_fields (definição)
   - form_fields (vínculo com este form)
           |
           v
6. Campo aparece APENAS neste formulário
```

---

## Migração de Dados Existentes

Para formulários existentes, criar registros em `form_fields` baseado no JSON `forms.fields`:

```sql
-- Migrar dados existentes
INSERT INTO form_fields (form_id, field_id, display_order)
SELECT 
  f.id as form_id,
  (elem::text)::uuid as field_id,
  (row_number() OVER (PARTITION BY f.id))::integer as display_order
FROM forms f,
  jsonb_array_elements(f.fields) WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(f.fields) = 'array'
  AND f.fields != '[]'::jsonb
ON CONFLICT (form_id, field_id) DO NOTHING;
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| Nova migração SQL | Criar tabela `form_fields` + migração de dados |
| `src/components/forms/FormFieldsManager.tsx` | **CRIAR** - Gerenciador de campos por formulário |
| `src/pages/Forms.tsx` | Refatorar para usar `form_fields` |
| `src/components/forms/index.ts` | Exportar novo componente |

---

## Benefícios

1. **Isolamento total**: Campos de um formulário não aparecem em outros
2. **Ordem preservada**: Cada formulário tem sua própria ordem de campos
3. **Simplicidade para o usuário**: "Gerenciar Campos" mostra apenas o relevante
4. **Compatibilidade**: Campos globais continuam funcionando para Clientes/Deals/Leads
5. **Sem duplicação visual**: Elimina o problema dos dois "Nome Completo"
