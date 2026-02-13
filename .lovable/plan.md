

## Habilitar MQL, Canal e Faturamento na integracao e no cadastro do Lead

### Problema
A edge function `create-lead` nao popula as colunas `mql` e `canal` no banco. O `revenue_range` ja e salvo corretamente. Alem disso, a UI do detalhe do Lead nao exibe mais esses 3 campos.

### Mudancas

**1. Edge Function `supabase/functions/create-lead/index.ts`**
- Adicionar `mql` e `canal` na interface `CreateLeadPayload`
- Incluir ambos no `.insert()` para gravar nas colunas corretas do banco
- Isso permite que o n8n envie `mql` e `canal` como campos separados no JSON

**2. UI `src/components/leads/LeadDetailSheet.tsx`**
- Re-adicionar a exibicao dos 3 campos fixos (MQL, Canal, Faturamento Atual) como badges/texto na secao de detalhes, logo abaixo do Proprietario
- Buscar os valores diretamente do registro do lead (`lead.mql`, `lead.canal`, `lead.revenue_range`)
- Exibir com estilo de badge sutil: "MQL: valor", "Canal: valor", "Faturamento Atual: valor"
- Campos sem valor exibem "---"

**3. Hook `src/hooks/useLeads.tsx`**
- Re-adicionar `mql`, `canal` e `revenue_range` na interface `Lead` (as colunas ja existem no banco e o `select(*)` ja as retorna)

### Ajuste no n8n (lado do usuario)
O payload do HTTP Request precisara enviar `mql` e `canal` como campos separados no JSON em vez de embuti-los apenas em `tags` e `source`. Exemplo:

```text
{
  "full_name": "...",
  "phone": "...",
  "source": "Trafego Pago",
  "canal": "Trafego Pago",
  "mql": "SIM - Acima de 30k",
  "revenue_range": "Entre 50 a 70 mil reais",
  "tags": ["[TRAF-STUDIO-EC]"]
}
```

### O que NAO muda
- Colunas no banco (ja existem)
- Formulario de criacao/edicao manual de leads (nao reinsere esses campos la)
- Nenhuma outra funcionalidade existente
