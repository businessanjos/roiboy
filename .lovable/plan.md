

## Filtrar vendedores por setor de Vendas no painel de ajustes

### Problema

O painel de ajustes do visual "Calls Comerciais" busca **todos os usuarios da conta** na tabela `users`, incluindo pessoas de outros setores (Operacoes, Financeiro, etc.). Deveria listar apenas os vendedores que tem acesso ao setor de **Vendas**.

### Solucao

Alterar a query de busca de usuarios no `VisualQuickSettings.tsx` para consultar a tabela `user_sector_access` com filtro `sector_id = 'vendas'`, trazendo apenas os usuarios ativos nesse setor.

### Mudanca tecnica

**Arquivo: `src/components/insights/visuals/VisualQuickSettings.tsx`**

Substituir a query atual:

```text
supabase
  .from('users')
  .select('name')
  .eq('account_id', currentUser.account_id)
  .order('name')
```

Por uma query que filtra pelo setor de vendas:

```text
supabase
  .from('user_sector_access')
  .select('user:users!user_sector_access_user_id_fkey(name)')
  .eq('account_id', currentUser.account_id)
  .eq('sector_id', 'vendas')
  .eq('is_active', true)
```

O resultado sera mapeado para extrair os nomes dos usuarios e ordenado alfabeticamente. Isso garantira que apenas Everton Pieri, Jonathan Marcato, Darlan Ferreira, Vanessa Minelli e George Oliveira aparecam na lista.

