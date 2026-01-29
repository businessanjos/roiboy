
# Plano: Corrigir Duplicação de Contratos na Aba de Triagem

## Problema Identificado

A cliente **Camila De Azevedo Dos Santos** tem 2 contratos no banco de dados (datas: 28/01/2026 e 29/01/2026), mas cada um aparece **2 vezes** na tela, totalizando 4 entradas.

### Causa Raiz

A página `Contracts.tsx` renderiza **duas tabelas simultaneamente** na aba de triagem:

1. `ContractTriageQueue` (linhas 1933-1946) - tabela específica de triagem com botões "Puxar" e "Atribuir"
2. Tabela genérica de contratos (linhas 1950-2093) - tabela padrão com botões "Ver Contrato" e "Excluir"

A tabela genérica está **fora do bloco condicional** `{activeTab === "triagem" && ...}`, sendo renderizada em todas as abas.

```text
ESTRUTURA ATUAL (INCORRETA):

{activeTab === "triagem" && (
  <>
    <Card info="Clientes aguardando..." />
    <ContractTriageQueue ... />    ← Tabela 1 (com Puxar/Atribuir)
  </>
)}

<Card>                              ← Tabela 2 (SEMPRE renderizada!)
  <Table>{filteredContracts}</Table>
</Card>
```

### Evidência Visual da Duplicação

Na imagem enviada, é possível ver:
- **Tabela 1** (topo): Colunas "Cliente | Tipo | Valor | Data Início | Status | Ações" com botões **Puxar** e **Atribuir a...**
- **Tabela 2** (abaixo): Colunas "Cliente | Tipo | Valor | Período | Status | Ações" com botão **Ver Contrato**

São duas tabelas distintas mostrando os mesmos dados!

## Solução Proposta

Adicionar condição para **não renderizar** a tabela genérica quando a aba ativa for "triagem".

## Arquivo a Modificar

**src/pages/Contracts.tsx**

## Alteração

### Ocultar tabela genérica na aba de triagem (linha ~1950)

Envolver a tabela genérica de contratos com uma condição:

```typescript
{/* Contracts Table - hide on triagem tab since it has its own component */}
{activeTab !== "triagem" && (
  <Card>
    <CardContent className="p-0">
      {filteredContracts.length === 0 ? (
        // ... empty state
      ) : (
        <Table>
          // ... tabela de contratos
        </Table>
      )}
    </CardContent>
  </Card>
)}
```

## Detalhes Técnicos

| Aspecto | Situação Atual | Após Correção |
|---------|----------------|---------------|
| Aba "Conciliação" | Tabela genérica | Tabela genérica |
| Aba "Triagem" | ContractTriageQueue + Tabela genérica (duplicado!) | Apenas ContractTriageQueue |
| Aba "Conciliados" | Tabela genérica | Tabela genérica |

## Resultado Esperado

- Na aba "Triagem", cada contrato aparecerá **apenas uma vez**
- A cliente Camila aparecerá com seus 2 contratos (um por linha), não 4
- O badge "Triagem 2" refletirá corretamente os 2 contratos
