
# Plano: Remover Campos de Vendas dos Formulários de Operações

## Diagnóstico

Através da análise do banco de dados, foi identificado que **campos exclusivos de Vendas** foram manualmente vinculados a um formulário do setor de Operações ("Cadastro Empresarial"):

| Campo | Pertence a | Vinculado em |
|-------|------------|--------------|
| MQL | Vendas (show_in_deals = true) | Cadastro Empresarial (Operações) |
| Origem da Venda | Vendas (show_in_deals = true) | Cadastro Empresarial (Operações) |
| Gravação da Sessão | Vendas (show_in_deals = true) | Cadastro Empresarial (Operações) |
| Descrição da Negociação da Venda | Vendas (show_in_deals = true) | Cadastro Empresarial (Operações) |

## Solução em 2 Partes

### Parte 1: Limpeza do Banco de Dados

Executar uma migração SQL para remover os vínculos incorretos da tabela `form_fields`:

```sql
-- Remover campos de Vendas (show_in_deals = true, show_in_clients = false) 
-- que estão vinculados a formulários de Operações
DELETE FROM form_fields 
WHERE id IN (
  SELECT ff.id
  FROM form_fields ff
  JOIN custom_fields cf ON ff.field_id = cf.id
  JOIN forms f ON ff.form_id = f.id
  WHERE f.sector_id = 'operacoes'
    AND cf.show_in_deals = true
    AND cf.show_in_clients = false
);
```

**Registros a serem removidos:**
- `form_field_id: cf6ecdc7-ce70-4b61-be04-7675e18e9e1f` (MQL)
- `form_field_id: 362575db-dfa9-4cd8-8c16-d1337a66420d` (Origem da Venda)
- `form_field_id: 0cd361a7-2a78-469f-91ed-1639ac949c18` (Gravação da Sessão)
- `form_field_id: 5a5b1594-f19d-4e37-9621-513be27df852` (Descrição da Negociação da Venda)

### Parte 2: Prevenção Futura (Opcional)

Para evitar que isso aconteça novamente, podemos adicionar validação no `FormFieldsManager.tsx` ao criar/vincular campos:

```typescript
// Ao criar um novo campo vinculado a um formulário de um setor específico,
// garantir que as flags de setor correspondam ao setor do formulário
const { data: formData } = await supabase
  .from("forms")
  .select("sector_id")
  .eq("id", formId)
  .single();

// Definir flags baseado no setor do formulário
const sectorFlags = {
  show_in_clients: formData.sector_id === 'operacoes',
  show_in_deals: formData.sector_id === 'vendas',
  show_in_leads: formData.sector_id === 'marketing',
};
```

## Arquivos a Modificar

| Componente | Ação |
|------------|------|
| Banco de Dados | Migração para remover vínculos incorretos |
| `FormFieldsManager.tsx` | (Opcional) Adicionar validação de setor ao criar campos |

## Resultado Esperado

1. Os campos "Origem da Venda", "Gravação da Sessão", "Descrição da Negociação da Venda" e "MQL" **não aparecerão mais** nos formulários de Operações
2. Campos de Operações continuarão funcionando normalmente
3. Futuras criações de campos respeitarão o isolamento de setor
