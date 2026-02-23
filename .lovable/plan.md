

## Corrigir orientacao do visual "Faturamento Diario por Vendedor"

### Causa raiz

O campo `chartOrientation` nao esta definido na config desse visual no banco de dados. O codigo em `ConfigurableChart.tsx` usa um fallback automatico:

```
orientation = chartOrientation || (dimension.type === 'date' ? 'vertical' : 'horizontal')
```

Como a dimensao e do tipo `date`, o fallback sempre resulta em `'vertical'` (barras verticais), mas o visual deveria ser horizontal.

### Solucao em dois pontos

#### 1. Atualizar o registro no banco de dados

Definir `chartOrientation: 'horizontal'` na config do visual `14166e52-4ab3-4934-9a08-c0ca4f58d2eb`:

```sql
UPDATE insights_visuals 
SET config = jsonb_set(config, '{chartOrientation}', '"horizontal"') 
WHERE id = '14166e52-4ab3-4934-9a08-c0ca4f58d2eb';
```

#### 2. Remover o fallback automatico que muda a orientacao

Em `ConfigurableChart.tsx`, o fallback `dimension.type === 'date' ? 'vertical' : 'horizontal'` e a causa raiz do problema -- ele muda a orientacao automaticamente com base no tipo de dimensao, ignorando a intencao do usuario. 

Alterar para que, quando `chartOrientation` nao estiver definido, o default seja sempre `'horizontal'` (o comportamento original do grafico empilhado):

```typescript
orientation={visualConfig?.chartOrientation || 'horizontal'}
```

Isso garante que nenhum visual mude de orientacao sozinho. A orientacao so muda se for explicitamente configurada pelo usuario.

### Resultado

- O visual "Faturamento Diario por Vendedor" volta a ser horizontal
- Nenhum visual empilhado muda de orientacao inesperadamente no futuro
- Quem quiser orientacao vertical precisa definir explicitamente `chartOrientation: 'vertical'`
