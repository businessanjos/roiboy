
## Adicionar etapa "Ganhos" ao Funil de Vendas

### Objetivo

Inserir automaticamente uma ultima barra no funil de "Etapas de Vendas" mostrando quantos negocios foram efetivamente convertidos em vendas (status = 'won'), completando a visao do processo de ponta a ponta.

### Solucao

**Arquivo:** `src/hooks/useVisualData.ts`

Apos a ordenacao do funil por `display_order` (linha 87), consultar a contagem de negocios ganhos e adicionar um item "Ganhos" ao final do array `result`:

```text
// Apos o sort por display_order, buscar deals ganhos
const { count: wonCount } = await supabase
  .from('deals')
  .select('id', { count: 'exact', head: true })
  .eq('account_id', currentUser.account_id)
  .eq('status', 'won')
  // Aplicar mesmos filtros de data se existirem

result.push({
  name: 'Ganhos',
  value: wonCount || 0,
  color: '#10b981'  // Verde esmeralda (mesmo do SalesFunnelChart)
});
```

**Arquivo:** `src/components/insights/visuals/ConfigurableFunnel.tsx`

Adicionar destaque visual para a barra "Ganhos" com um emoji de trofeu e anel verde (ring), similar ao tratamento de "Venda" no `SalesFunnelChart`:

```text
// Na barra "Ganhos":
- Adicionar ring-2 ring-emerald-400 ring-offset-2
- Prefixar nome com emoji trofeu
- Mostrar valor bruto (nao cumulativo) para esta etapa
```

### Detalhes

- A etapa "Ganhos" nao participa da contagem cumulativa -- ela mostra o valor bruto de negocios ganhos
- Sua largura no funil e calculada proporcionalmente ao total cumulativo da primeira etapa
- Os filtros de data do painel de insights serao aplicados a contagem de ganhos
- A cor verde (#10b981) e fixa, independente da paleta escolhida

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useVisualData.ts` | Buscar contagem de deals ganhos e adicionar ao resultado do funil |
| `src/components/insights/visuals/ConfigurableFunnel.tsx` | Destacar visualmente a barra "Ganhos" com trofeu e anel verde |
