

## Corrigir salvamento automático de respostas de formulário nos campos personalizados do cliente

### Problema identificado

Quando um cliente preenche um formulário público, a Edge Function `submit-form-response` salva a resposta na tabela `form_responses`, cria notificações e dispara análise de IA, mas **nunca salva os valores nos campos personalizados do cliente** (`client_field_values`). Esse salvamento só acontece manualmente quando alguém clica um botão na página de Formulários (função `saveResponsesToClient` em `Forms.tsx`).

Isso significa que, mesmo com o formulário corretamente vinculado ao perfil da cliente Ângela, os 72 campos personalizados permanecem vazios na aba "Campos".

### Causa raiz

1. A Edge Function `submit-form-response` não busca o campo `fields` da tabela `forms` (que contém os IDs dos campos personalizados associados).
2. Não há lógica na Edge Function para buscar as definições dos campos (`custom_fields`) e mapear as respostas para a tabela `client_field_values`.

### Solução

**Arquivo:** `supabase/functions/submit-form-response/index.ts`

#### 1. Incluir `fields` na query do formulário
Alterar a query que busca o form para incluir o campo `fields`:

```sql
.select("id, account_id, is_active, require_client_info, title, fields")
```

#### 2. Após inserir o form_response com sucesso e com um cliente vinculado, salvar nos campos personalizados

Adicionar um novo bloco após a inserção da resposta (e antes das notificações) que:

1. Verifica se há `resolvedClientId` e se o form tem `fields` definidos
2. Busca as definições dos campos personalizados da tabela `custom_fields` usando os IDs do array `fields`
3. Para cada campo com resposta, faz upsert em `client_field_values` mapeando o valor para a coluna correta baseada no `field_type`:
   - `boolean` -> `value_boolean`
   - `number`, `currency`, `rating` -> `value_number`
   - `date` -> `value_date`
   - `multi_select` -> `value_json`
   - `text`, `select` e outros -> `value_text`

#### 3. Criar uma Edge Function auxiliar para retroativamente corrigir a Ângela

Executar uma correção pontual usando o formulário de resposta já salvo, chamando a mesma lógica de mapeamento para popular os campos dela. Isso será feito como parte do deploy - a lógica será integrada diretamente na Edge Function principal, e para a correção pontual, será necessário re-submeter os dados da resposta existente.

**Alternativa mais simples para a correção pontual:** Adicionar uma função no frontend (`Forms.tsx`) ou reutilizar a `saveResponsesToClient` existente para processar a resposta já cadastrada da Ângela. Como essa função já existe e funciona, basta o usuário acessar a página de Formulários e vincular manualmente. Porém, para blindar o sistema, a solução na Edge Function garante que isso nunca mais seja necessário.

### Detalhes técnicos da implementação

```typescript
// Novo bloco na Edge Function, após inserção do form_response
if (resolvedClientId && form.fields && Array.isArray(form.fields) && form.fields.length > 0) {
  try {
    // Buscar definições dos campos
    const { data: fieldDefs } = await supabase
      .from("custom_fields")
      .select("id, field_type")
      .in("id", form.fields)
      .eq("is_active", true);

    if (fieldDefs && fieldDefs.length > 0) {
      const upserts = [];
      for (const fieldDef of fieldDefs) {
        const value = sanitizedResponses[fieldDef.id];
        if (value === undefined || value === null || value === "") continue;

        const row: any = {
          account_id: form.account_id,
          client_id: resolvedClientId,
          field_id: fieldDef.id,
        };

        switch (fieldDef.field_type) {
          case "boolean":
            row.value_boolean = Boolean(value);
            break;
          case "number":
          case "currency":
          case "rating":
            row.value_number = Number(value) || null;
            break;
          case "date":
            row.value_date = value;
            break;
          case "multi_select":
            row.value_json = value;
            break;
          default:
            row.value_text = String(value);
        }

        upserts.push(row);
      }

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("client_field_values")
          .upsert(upserts, { onConflict: "client_id,field_id" });

        if (upsertError) {
          console.warn("Error saving field values:", upsertError);
        } else {
          console.log(`Saved ${upserts.length} field values for client ${resolvedClientId}`);
        }
      }
    }
  } catch (fieldErr) {
    console.warn("Error processing field values:", fieldErr);
  }
}
```

### Correção retroativa para a cliente Ângela

Como a resposta dela já está salva na tabela `form_responses` com o `client_id` correto, criaremos um script SQL ou uma chamada via a função `saveResponsesToClient` que já existe no frontend. A forma mais segura é criar uma Edge Function one-shot `backfill-form-field-values` que:

1. Busca todas as `form_responses` que têm `client_id` vinculado
2. Para cada resposta, busca o form e seus `fields`
3. Faz o upsert nos `client_field_values`

Isso também corrige qualquer outro caso que possa ter sido afetado no passado.

### Resumo das mudanças

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/submit-form-response/index.ts` | Adicionar `fields` na query e novo bloco para salvar em `client_field_values` |
| `supabase/functions/backfill-form-field-values/index.ts` | Nova Edge Function para correção retroativa de todas as respostas existentes |
