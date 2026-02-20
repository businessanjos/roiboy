

## Adicionar botao "Revogar" para acessos aprovados

### Alteracoes

#### 1. Frontend `src/components/insights/ShareDashboardModal.tsx`

Na secao onde o status e "approved" (linha 269-271), substituir o Badge isolado por um grupo contendo o Badge + um botao sutil de revogar:

- Adicionar um pequeno botao `ghost` com icone `XCircle` ao lado do Badge "Liberado"
- Ao clicar, chamar `handleAction(req.id, "reject")` -- a mesma funcao ja existente que atualiza o status via edge function `manage-share-access`
- O botao tera estilo discreto (opacidade reduzida, aparecendo mais visivel no hover)
- Mostrar spinner enquanto processa

#### 2. Edge Function `supabase/functions/manage-share-access/index.ts`

Nenhuma alteracao necessaria. A funcao ja suporta a action `"reject"` para qualquer request independente do status atual, pois faz um simples `UPDATE ... SET status = 'rejected'`. Revogar um acesso aprovado e equivalente a rejeita-lo.

### Resultado visual

O item aprovado passara de:

```
joao.ferrari1982@gmail.com    [Liberado]
Liberado
```

Para:

```
joao.ferrari1982@gmail.com    [Liberado] (x)
Liberado
```

Onde `(x)` e um botao sutil que aparece com mais destaque no hover.
