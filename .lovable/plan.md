
# Plano: Campo para Nomear Telefones Adicionais

## Visão Geral

Adicionar um campo de "rótulo" ao lado de cada telefone adicional na janela de edição do cliente, permitindo que o time de operações identifique facilmente a quem pertence ou qual é a finalidade de cada número (ex: "Esposa", "Trabalho", "Secretária").

## Layout Proposto

```
┌──────────────────────────────────────────────────────────────────────┐
│ TELEFONES ADICIONAIS                                                 │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ [Secretária: +55 11 99999-9999] ×  [Esposa: +55 31 98888-8888] ×│  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌──────────────────────┐ ┌─────────────────────────────────┐  ┌───┐ │
│ │ Rótulo (opcional)    │ │ +55 11 99999-9999               │  │ + │ │
│ └──────────────────────┘ └─────────────────────────────────┘  └───┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Mudanças Técnicas

### 1. Alteração de Tipos (ClientInfoForm.tsx)

**De:**
```typescript
additional_phones: string[];
```

**Para:**
```typescript
additional_phones: Array<{ number: string; label?: string }> | string[];
```

A interface aceita ambos os formatos para compatibilidade com dados existentes.

### 2. Migração Automática de Dados Legados

Quando o usuário abrir o diálogo de edição, os telefones em formato antigo (`string[]`) serão convertidos automaticamente para o novo formato (`{ number, label }[]`):

```typescript
// Converter ["phone1", "phone2"] para [{ number: "phone1" }, { number: "phone2" }]
const normalizePhones = (phones: any[]): Array<{ number: string; label?: string }> => {
  return phones.map(p => typeof p === "string" ? { number: p } : p);
};
```

### 3. Atualização da UI (ClientInfoForm.tsx)

- Adicionar estado `newPhoneLabel` para o rótulo do novo telefone
- Inserir campo de input para rótulo antes do campo de telefone
- Atualizar renderização dos badges para exibir "Rótulo: Número"
- Ajustar funções `handleAddPhone` e `handleRemovePhone`

### 4. Atualização da Busca no Webhook (uazapi-webhook)

A consulta JSONB precisa ser atualizada para suportar o novo formato:

**De:**
```sql
additional_phones.cs.["${phone}"]
```

**Para (usando OR para suportar ambos formatos):**
```sql
additional_phones.cs.["${phone}"],additional_phones.cs.[{"number":"${phone}"}]
```

Isso garante que tanto telefones no formato antigo quanto no novo sejam encontrados.

### 5. Compatibilidade na Visualização

Todos os componentes que exibem telefones adicionais precisam de lógica defensiva:

```typescript
const displayPhone = (phone: string | { number: string; label?: string }) => {
  if (typeof phone === "string") return phone;
  return phone.label ? `${phone.label}: ${phone.number}` : phone.number;
};
```

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/client/ClientInfoForm.tsx` | Interface, estados, funções de add/remove, UI com campo de rótulo |
| `src/pages/ClientDetail.tsx` | Normalização dos dados ao abrir diálogo |
| `supabase/functions/uazapi-webhook/index.ts` | Consulta JSONB para suportar novo formato |
| `src/components/sales/DealLeadInfo.tsx` | Exibição compatível com ambos formatos |
| `src/hooks/useDuplicateDetection.tsx` | Busca compatível com ambos formatos |

## Comportamento do Usuário

1. **Ao abrir o diálogo de edição**: Telefones existentes aparecem como badges (com rótulo se houver)
2. **Ao adicionar novo telefone**: 
   - Usuário pode opcionalmente preencher o campo "Rótulo" (ex: "Trabalho")
   - Preenche o telefone
   - Clica no "+" ou pressiona Enter
3. **Exibição**: Telefones com rótulo aparecem como "Trabalho: +55 11 99999-9999"

## Compatibilidade Retroativa

- Dados existentes no formato `["phone1", "phone2"]` continuam funcionando
- Ao salvar, todos os telefones são convertidos para o novo formato
- Busca no webhook funciona com ambos os formatos
- Não é necessária migração de dados no banco (conversão é feita no frontend)

## Resultado Esperado

O time de operações poderá:
1. Identificar rapidamente a quem pertence cada número adicional
2. Filtrar visualmente quais números são de familiares, trabalho, assistentes, etc.
3. Tomar decisões mais rápidas sobre para qual número ligar/enviar mensagens
