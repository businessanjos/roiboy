

## Corrigir: Status de atividades nos cards do Pipeline nao atualiza apos conclusao

### Causa raiz

O hook `useDealActivityStatus` esta configurado com `refetchOnWindowFocus: false`, o que impede a atualizacao dos dados quando o usuario volta para a aba do Pipeline. Alem disso, o `staleTime` de 30 segundos faz com que dados em cache sejam servidos mesmo apos a conclusao de tarefas em outro contexto (ex: dentro do DealDetailSheet).

A assinatura Realtime esta configurada, porem o `refetchOnWindowFocus: false` e o fator principal do problema reportado -- ao concluir uma tarefa e atualizar a pagina, a query remonta mas pode haver condicoes de corrida com o cache do React Query.

### Solucao

Ajustar a configuracao do React Query no hook `useDealActivityStatus` para garantir atualizacao imediata:

### Mudancas tecnicas

**`src/hooks/useDealActivityStatus.ts`**

1. Alterar `refetchOnWindowFocus` de `false` para `true` -- ao voltar para a aba ou apos F5, os dados serao rebuscados automaticamente
2. Reduzir `staleTime` de 30 segundos para 5 segundos -- dados ficam frescos por menos tempo, garantindo que ao navegar entre paineis o status seja atualizado rapidamente
3. Adicionar `refetchOnMount: 'always'` -- garante que ao remontar o componente (ex: trocar de etapa no pipeline e voltar), os dados sejam sempre rebuscados do banco

```
staleTime: 5 * 1000,
refetchOnWindowFocus: true,
refetchOnMount: 'always',
```

### Resultado

- Ao concluir uma tarefa e voltar ao Pipeline, o card reflete o status correto imediatamente
- Ao dar F5 ou trocar de aba e voltar, os dados sao atualizados
- A assinatura Realtime continua funcionando como fallback para mudancas de outros usuarios
- O impacto em performance e minimo pois a query e leve (busca apenas id, due_date, completed_at e custom_status por deal)

