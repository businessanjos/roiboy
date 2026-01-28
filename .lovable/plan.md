

# Plano: Transferir Campos Personalizados do Negócio para Timeline do Cliente

## Contexto

Atualmente, quando um negócio é marcado como "Ganho" e o Lead é convertido em Cliente:
- ✅ As notas de "Call Comercial Concluída" são transferidas para a Timeline do cliente
- ❌ Os **Campos Personalizados** do negócio NÃO são inseridos na Timeline

O usuário precisa que os valores preenchidos nos Campos Personalizados (como Cidade, Item da Venda, Canal de Venda, MQL, etc.) também sejam registrados na Timeline do cliente como uma anotação.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/utils/dealToClientContractMapping.ts` | Nova função para formatar campos em texto legível |
| `src/pages/SalesPipeline.tsx` | Adicionar STEP 4.6 para inserir anotação dos campos na timeline |

## Solução Proposta

### 1. Nova Função: Formatar Campos Personalizados

Criar uma função que busca todos os campos personalizados do negócio (não apenas os mapeados) e retorna um texto formatado:

```typescript
export async function formatDealCustomFieldsForTimeline(
  dealId: string,
  accountId: string
): Promise<string | null> {
  // 1. Buscar definição dos campos (name, field_type, options)
  const { data: fields } = await supabase
    .from("custom_fields")
    .select("id, name, field_type, options")
    .eq("account_id", accountId)
    .eq("show_in_deals", true)
    .eq("is_active", true)
    .order("display_order");

  // 2. Buscar valores dos campos para este deal
  const { data: values } = await supabase
    .from("deal_field_values")
    .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
    .eq("deal_id", dealId);

  // 3. Montar texto formatado
  const lines: string[] = [];
  
  for (const field of fields) {
    const valueRow = values?.find(v => v.field_id === field.id);
    if (!valueRow) continue;
    
    const formattedValue = formatFieldValue(field, valueRow);
    if (formattedValue) {
      lines.push(`• ${field.name}: ${formattedValue}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function formatFieldValue(field: any, valueRow: any): string | null {
  switch (field.field_type) {
    case 'text':
    case 'instagram':
      return valueRow.value_text || null;
    
    case 'select':
      // Buscar label da opção
      const option = field.options?.find(o => o.value === valueRow.value_text);
      return option?.label || valueRow.value_text || null;
    
    case 'multi_select':
      // Array de valores -> labels
      const values = valueRow.value_json as string[] || [];
      const labels = values.map(v => {
        const opt = field.options?.find(o => o.value === v);
        return opt?.label || v;
      });
      return labels.length > 0 ? labels.join(', ') : null;
    
    case 'boolean':
      return valueRow.value_boolean ? 'Sim' : 'Não';
    
    case 'number':
      return valueRow.value_number?.toString() || null;
    
    case 'currency':
      return valueRow.value_number 
        ? `R$ ${valueRow.value_number.toLocaleString('pt-BR')}` 
        : null;
    
    case 'date':
      return valueRow.value_date 
        ? new Date(valueRow.value_date).toLocaleDateString('pt-BR') 
        : null;
    
    case 'location':
      const loc = valueRow.value_json;
      if (loc?.formatted_address) return loc.formatted_address;
      if (loc?.city && loc?.state) return `${loc.city}, ${loc.state}`;
      return null;
    
    case 'user':
      // Para campos de usuário, buscar nome (simplificado)
      const userIds = valueRow.value_json;
      return userIds?.length > 0 ? `${userIds.length} usuário(s)` : null;
    
    default:
      return valueRow.value_text || null;
  }
}
```

### 2. Adicionar STEP 4.6 no handleMarkAsWon

No arquivo `SalesPipeline.tsx`, após o STEP 4.5 (transferência das notas de Call):

```typescript
// STEP 4.6: Transfer Deal Custom Fields to client timeline
if (clientId && currentUser?.account_id) {
  try {
    const customFieldsText = await formatDealCustomFieldsForTimeline(dealId, currentUser.account_id);
    
    if (customFieldsText) {
      const { error: fieldsNoteError } = await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: "note",
          title: "📋 Dados da Negociação",
          content: customFieldsText,
        });
      
      if (fieldsNoteError) {
        console.error("[MarkAsWon] Error transferring custom fields:", fieldsNoteError);
      } else {
        console.log("[MarkAsWon] Custom fields transferred to client timeline");
      }
    }
  } catch (fieldsError) {
    console.error("[MarkAsWon] Error in custom fields transfer:", fieldsError);
    // Non-blocking - continue the flow
  }
}
```

## Resultado Esperado

### Na Timeline do Cliente (após conversão)

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Dados da Negociação                                     │
│  Há poucos segundos • Você                                  │
├─────────────────────────────────────────────────────────────┤
│  • Cidade: Irecê, Bahia, Brasil                             │
│  • Canal de Venda: Orgânico                                 │
│  • Faturamento Atual: Entre 30 e 50 mil reais               │
│  • MQL: SIM - Acima de 30k                                  │
│  • Item da Venda: Rykas Mentoring                           │
│  • Origem da Venda: ORG-EVER, JJ - Podcast                  │
│  • Data do primeiro contato: 26/01/2026                     │
│  • Ganhou Bônus?: (valor se preenchido)                     │
│  • Instagram: @dra.carellicassia                            │
└─────────────────────────────────────────────────────────────┘

│  📞 Call Comercial Concluída                                │
│  (notas da call - já existente)                             │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Execução

```text
handleMarkAsWon()
│
├── STEP 1-3: Conversão Lead → Cliente
│
├── STEP 4: Atualizar cliente com dados mapeados
│
├── STEP 4.5: Transferir notas de Call Comercial ✅ (existente)
│
├── STEP 4.6: Transferir Campos Personalizados ← NOVO
│   ├── Buscar definição dos campos (custom_fields)
│   ├── Buscar valores preenchidos (deal_field_values)
│   ├── Formatar texto legível com labels
│   └── Inserir em client_followups
│
├── STEP 5: Criar contrato
│
└── STEP 6: Marcar negócio como ganho
```

## Detalhes Técnicos

### Tipos de Campo Suportados

| Tipo | Formatação |
|------|------------|
| `text` / `instagram` | Valor direto |
| `select` | Label da opção |
| `multi_select` | Labels separados por vírgula |
| `boolean` | "Sim" ou "Não" |
| `number` | Número formatado |
| `currency` | "R$ X.XXX,XX" |
| `date` | "DD/MM/AAAA" |
| `location` | "Cidade, Estado" ou endereço completo |
| `user` | "X usuário(s)" |

### Tratamento de Erros

- A transferência é **não-bloqueante** (não impede o fluxo de marcar como ganho)
- Campos sem valor preenchido são ignorados
- Se não houver nenhum campo preenchido, nenhuma anotação é criada

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Histórico Completo** | Todos os dados da negociação ficam na Timeline do cliente |
| **Rastreabilidade** | Equipe de Operações vê exatamente o que foi negociado |
| **Consistência** | Segue o mesmo padrão das notas de Call Comercial |
| **Não-destrutivo** | Dados originais permanecem no negócio |

