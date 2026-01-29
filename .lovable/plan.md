
# Plano: Corrigir Limite de 50 Clientes na Listagem

## Problema Identificado

A consultora Michele Santos tem **240 clientes totais** (84 com contrato ativo), mas o filtro retorna apenas **50 clientes**.

### Causa Raiz

Na edge function `list-clients`, linha 54, existe uma limitacao forcada:

```typescript
// Reduced max limit from 200 to 50 to optimize Cloud costs
const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 50);
```

Essa alteracao foi feita anteriormente para "otimizar custos de Cloud", porem causa problemas quando usuarios precisam ver mais clientes.

O frontend solicita 200 clientes, mas a edge function ignora e retorna apenas 50.

## Dados da Michele Santos

| Metrica | Quantidade |
|---------|-----------|
| Total de clientes | 240 |
| Contratos ativos | 84-85 |
| Contratos encerrados | 93 |
| Contratos cancelados | 31 |
| Outros status | 31 |

Ela mencionou ter "86 alunas" - que corresponde aproximadamente aos 84-85 contratos ativos.

## Solucao Proposta

Aumentar o limite maximo para 200 (ou remover o limite forcado) na edge function, permitindo que o frontend controle a paginacao.

### Alteracao no Arquivo

**Arquivo: `supabase/functions/list-clients/index.ts`**

**Linha 54** - Alterar de:
```typescript
const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 50);
```

Para:
```typescript
const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
```

## Justificativa

1. O limite de 50 e muito baixo para usuarios com muitos clientes
2. 200 ainda e um limite razoavel que nao sobrecarrega o sistema
3. O frontend ja solicita 200, entao nao precisa de outras alteracoes
4. A paginacao continua funcionando normalmente para bases maiores

## Impacto

| Cenario | Antes | Depois |
|---------|-------|--------|
| Michele filtra seus clientes | 50 resultados | Ate 200 resultados |
| Usuarios com poucos clientes | Sem mudanca | Sem mudanca |
| Performance | Leve aumento de carga | Aceitavel |

## Resultado Esperado

1. Michele vera todos os seus 84 clientes com contrato ativo ao filtrar
2. A contagem total (86 mencionados vs 84 reais) esta dentro da margem esperada
3. Outros usuarios com muitos clientes tambem serao beneficiados
