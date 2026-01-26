
# Plano: Correção do Visual de Faturamento por Mês

## Diagnóstico

O visual "Faturamento por Mês" está configurado incorretamente:

| Campo | Valor Atual | Valor Correto |
|-------|-------------|---------------|
| `dimension.field` | `created_at` | `won_at` |

### Fluxo do Problema

```text
1. Visual configurado com dimension.field = "created_at"
2. useVisualData usa created_at para filtrar datas
3. Busca TODOS os negócios criados no período (462)
4. Agrega por created_at (data de criação)
5. Resultado: mostra negócios open/lost/won misturados
6. Mas como a medida é SUM(value) e muitos têm value=0...
   O gráfico aparece sem barras visíveis ou com valores inconsistentes
```

### Evidência dos Dados

Query executada no banco:

```text
Com created_at (Jan/2026): 462 negócios, R$ 35.240.800
Com won_at (Jan/2026): 30 negócios, R$ 3.517.200
```

O visual de "Faturamento" deveria mostrar apenas os R$ 3.517.200 de negócios efetivamente ganhos.

---

## Causa Raiz

O modal de criação de visuais permite escolher o campo de data como `created_at` mesmo para métricas de faturamento, o que não faz sentido semântico. 

Para um visual de "Faturamento por Mês":
- A medida é `SUM(value)` (soma dos valores)
- A dimensão deveria ser `won_at` (agrupado por data de vitória)

---

## Solução Proposta

### Opção 1: Corrigir o Visual Existente (Recomendado para Curto Prazo)

Atualizar diretamente a configuração do visual no banco de dados:

```sql
UPDATE insights_visuals
SET config = jsonb_set(
  config,
  '{dimension,field}',
  '"won_at"'
)
WHERE id = '8f774cc5-7e6f-441f-b868-de5e3601b1aa';
```

Isso corrige imediatamente o visual existente.

### Opção 2: Melhorar o Modal de Criação (Recomendado para Longo Prazo)

Modificar o componente `AddVisualModal.tsx` para:
1. Quando a medida for "Valor (value)" e o campo for selecionado para agregar deals
2. Sugerir automaticamente `won_at` como campo de data
3. Ou adicionar opções semânticas como "Data de Vitória" e "Data de Perda" além de "Data de Criação"

**Arquivo:** `src/components/insights/AddVisualModal.tsx`

Adicionar ao passo de seleção de dimensão:

```typescript
// Quando dataSource === 'deals' e dimension.type === 'date'
const dealDateOptions = [
  { value: 'created_at', label: 'Data de Criação' },
  { value: 'won_at', label: 'Data de Vitória (Faturamento)' },
  { value: 'lost_at', label: 'Data de Perda' },
];
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Banco de dados | Corrigir configuração do visual existente via SQL |
| `src/components/insights/AddVisualModal.tsx` | Adicionar opções claras para campos de data em deals |
| `src/components/insights/visual-builder/types.ts` | Verificar se `won_at` e `lost_at` são opções válidas |

---

## Impacto da Correção

Após aplicar a correção:
1. O visual de "Faturamento por Mês" mostrará apenas negócios com status "won"
2. Agrupará corretamente por mês de vitória
3. Valor total de Janeiro: R$ 3.517.200 (30 negócios)
4. O "Explorar Dados" também mostrará apenas os 30 negócios ganhos

---

## Passos de Implementação

1. **Passo 1**: Executar migração SQL para corrigir o visual existente
2. **Passo 2**: Atualizar o modal de criação de visuais para mostrar opções de data mais claras
3. **Passo 3**: (Opcional) Adicionar validação para alertar quando a combinação dimension/measure não faz sentido semântico
