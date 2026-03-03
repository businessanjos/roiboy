

## Corrigir Vendedor e Descrição na OS do Omie

### Problemas identificados

1. **Vendedor não aparece na OS**: O valor do vendedor é resolvido corretamente (linha 188), mas **nunca é inserido no payload da OS**. Ele só aparece no campo `cObsOS` (observações). A API do Omie espera o campo `cVendedor` dentro de `Cabecalho` para preencher o campo "Vendedor" na OS.

2. **Descrição Detalhada usa título do negócio**: Na linha 222, `cDescServ` está hardcoded como `deal.title` ao invés de usar o valor resolvido pelo mapeamento (`descricao`). Mesmo que o usuário configure "Descrição" para buscar de "Item da Venda" (campo personalizado), o código ignora isso e sempre coloca o título do negócio.

### Alterações — `supabase/functions/create-omie-os/index.ts`

**Correção 1 — Adicionar vendedor ao Cabecalho (linha 209)**:
```typescript
Cabecalho: {
  cCodIntOS: `ROY-${deal_id.substring(0, 8)}`,
  cEtapa: '10',
  dDtPrevisao: ...,
  nCodCli: omieClient.codigo_cliente_omie,
  nQtdeParc: 1,
  cVendedor: vendedor,  // ← NOVO
},
```

**Correção 2 — Usar descrição mapeada em cDescServ (linha 222)**:
```typescript
// Antes:
cDescServ: deal.title,

// Depois:
cDescServ: descricao || deal.title,
```

Isso garante que `cDescServ` use o valor configurado no mapeamento (ex: "Item da Venda"), com fallback para o título do negócio caso o mapeamento esteja vazio.

