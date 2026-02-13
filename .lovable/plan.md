

## Excluir Lead com deals vinculados (cascade + aviso)

### Problema
A exclusao de um Lead falha quando ha negocios (deals) vinculados por causa da foreign key `deals_lead_id_fkey`. O usuario quer que os deals sejam excluidos junto, mas com um aviso previo listando os negocios afetados.

### Mudancas

**1. Hook `src/hooks/useLeads.tsx` - funcao `deleteLead`**

Refatorar para:
1. Consultar deals vinculados ao lead (`deals.lead_id = leadId`)
2. Retornar a lista de deals encontrados para a UI decidir se mostra o aviso
3. Criar uma nova funcao `deleteLeadWithDeals` que:
   - Deleta registros em `lead_field_values` (campos personalizados)
   - Deleta registros em `lead_timeline` (historico)
   - Deleta os deals vinculados
   - Deleta o lead

Nova funcao exposta:
```text
checkLeadDeals(leadId) -> Deal[] | null
deleteLeadWithDeals(leadId) -> boolean
```

**2. Componente `src/components/sales/LeadsTab.tsx` - AlertDialog de exclusao**

Refatorar o fluxo:
1. Ao clicar em "Excluir", buscar deals vinculados via `checkLeadDeals`
2. Se houver deals, exibir no AlertDialog uma lista com os nomes dos negocios e um aviso claro
3. Se nao houver deals, manter o aviso simples atual
4. Ao confirmar, chamar `deleteLeadWithDeals` que faz a exclusao em cascata

Exemplo visual do dialog quando ha deals:

```text
Excluir lead?

Este lead possui 2 negocios vinculados que tambem serao excluidos:

  - Negocio: Projeto Website (R$ 5.000)
  - Negocio: Consultoria SEO (R$ 2.000)

Esta acao nao pode ser desfeita.

[Cancelar]  [Excluir tudo]
```

### O que nao muda
- Botao de excluir na tabela e no detalhe do lead (mesmo local)
- Leads sem deals continuam sendo excluidos normalmente com o aviso simples
