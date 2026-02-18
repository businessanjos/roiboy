

## Diagnostico: Contratos Duplicados na Fila de Conciliacao

### Causa Raiz Identificada

O problema foi confirmado no banco de dados. Existem contratos duplicados vinculados ao mesmo negocio (`deal_id`):

```text
deal_id e6ef4c86... -> 2 contratos (criados 15:39 e 17:20 em 18/02)
deal_id 396dfd85... -> 2 contratos (criados 20:31 e 20:33 em 16/02)
```

**Por que isso acontece**: A funcao `handleMarkAsWon` no arquivo `SalesPipeline.tsx` faz um `INSERT` direto na tabela `client_contracts` **sem verificar se ja existe um contrato para aquele `deal_id`**. Alem disso, a coluna `deal_id` na tabela possui apenas um indice comum, nao uma constraint `UNIQUE`.

Cenarios que causam duplicacao:
1. **Duplo clique** -- mesmo com a protecao `processingWonDealId`, se o usuario clicar rapidamente, duas requisicoes podem passar antes do state atualizar.
2. **Reabrir e ganhar novamente** -- a funcao `reopenDeal` apaga o contrato, mas se o `DELETE` falhar silenciosamente (erro nao-bloqueante), ao ganhar novamente um segundo contrato e criado.
3. **Outro local de conversao** -- o componente `ClientDeals.tsx` tem seu proprio `handleMarkAsWon` que apenas atualiza o status, mas pode coexistir com o fluxo principal.

### O que sera feito

#### 1. Adicionar constraint UNIQUE no banco de dados (deal_id)

Impedir duplicatas a nivel de banco, garantindo que nenhum `deal_id` tenha mais de um contrato ativo.

```text
- Limpar duplicatas existentes (manter o mais recente, deletar os mais antigos)
- Criar indice UNIQUE parcial: deal_id WHERE deal_id IS NOT NULL
```

Isso garante protecao absoluta independente de qual codigo tente inserir.

#### 2. Adicionar verificacao antes do INSERT (SalesPipeline.tsx)

Antes de criar o contrato no `handleMarkAsWon`, verificar se ja existe um contrato para aquele `deal_id`:

```text
1. SELECT id FROM client_contracts WHERE deal_id = dealId LIMIT 1
2. Se ja existir -> pular criacao e logar aviso
3. Se nao existir -> proceder com INSERT normalmente
```

#### 3. Limpar duplicatas existentes no banco

Executar uma limpeza para remover os contratos duplicados ja existentes, mantendo apenas o registro mais recente de cada `deal_id`.

---

### Detalhes tecnicos

| Arquivo / Recurso | Alteracao |
|---|---|
| **Migracao SQL** | Limpar duplicatas existentes; criar constraint `UNIQUE` parcial em `client_contracts.deal_id` |
| `src/pages/SalesPipeline.tsx` | Adicionar check `SELECT` antes do `INSERT` no `handleMarkAsWon` (~linha 552) |

### Impacto

- Contratos duplicados existentes serao removidos automaticamente pela migracao
- Novos duplicatas serao impossibilitados tanto no frontend (check previo) quanto no banco (constraint UNIQUE)
- A logica de `reopenDeal` continua funcionando normalmente (deleta o contrato unico antes de reabrir)

