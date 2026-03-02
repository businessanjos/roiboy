

## Anexar campos "Instagram" e "Informação para Operação" na Timeline do Cliente ao ganhar negócio

### Situação Atual

O código já possui um STEP 4.6 no fluxo `handleMarkAsWon` que transfere TODOS os campos personalizados do negócio como uma única nota genérica "Dados da Negociação" na timeline do cliente. Porém, esses dados ficam agrupados em um único bloco de texto, o que pode dificultar a visibilidade.

### O que será feito

Adicionar um novo passo no fluxo `handleMarkAsWon` (STEP 4.7) que cria entradas **individuais e destacadas** na timeline do cliente para os campos "Instagram" e "Informação para Operação", quando preenchidos no negócio.

### Alterações técnicas

**Arquivo:** `src/pages/SalesPipeline.tsx`

Após o STEP 4.6 (linha 529), inserir um novo bloco que:

1. Busca os campos personalizados "Instagram" e "Informação para Operação" pelo nome na tabela `custom_fields`
2. Para cada campo encontrado, busca o valor na tabela `deal_field_values` para o deal em questão
3. Se o valor existir, cria uma entrada individual na tabela `client_followups` com:
   - **Instagram**: titulo "📸 Instagram do Negócio", conteúdo com o handle
   - **Informação para Operação**: titulo "📌 Informação para Operação", conteúdo com o texto

Ambos serão do tipo "note" e ficarão visíveis como entradas separadas na timeline, facilitando a consulta pela equipe de Operações.

### Lógica do novo passo

```text
STEP 4.7: Transfer specific fields to client timeline
  1. Query custom_fields WHERE name IN ('Instagram', 'Informação para Operação')
     AND account_id = current AND show_in_deals = true
  2. For each field found:
     a. Query deal_field_values WHERE deal_id AND field_id
     b. Extract value based on field_type (value_text for both)
     c. If value exists, INSERT into client_followups as individual note
```

Nenhuma migração de banco necessária - utiliza tabelas existentes (`custom_fields`, `deal_field_values`, `client_followups`).

