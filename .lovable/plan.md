
# Plano: Remover Campos Personalizados da Lista de Clientes (Correção)

## Diagnóstico do Problema

As alterações anteriores foram feitas nos componentes errados:
- ❌ `src/components/client/ClientsTable.tsx` - **NÃO É USADO** na página principal
- ❌ `src/components/client/ClientsTableRow.tsx` - **NÃO É USADO** na página principal
- ✅ `src/pages/Clients.tsx` - **ESTE É O ARQUIVO CORRETO** que renderiza a tabela diretamente

A página `Clients.tsx` tem sua própria implementação inline da tabela que não utiliza os componentes separados.

## Locais a Modificar em `src/pages/Clients.tsx`

| Linha | Código | O que fazer |
|-------|--------|-------------|
| 2092-2096 | `customFields.map()` no header | **REMOVER** - Gera colunas para cada campo |
| 2103 | `colSpan={5 + customFields.length}` | **ALTERAR** para `colSpan={9}` |
| 2110 | `colSpan={5 + customFields.length}` | **ALTERAR** para `colSpan={9}` |
| 2460-2472 | `customFields.map()` no body | **REMOVER** - Gera células para cada campo |

## Código a Remover

### 1. Remover colunas no cabeçalho (linhas 2092-2096):
```typescript
// REMOVER ESTE BLOCO:
{customFields.map((field) => (
  <TableHead key={field.id} className="font-medium text-center min-w-[120px]">
    {field.name}
  </TableHead>
))}
```

### 2. Remover células no corpo (linhas 2460-2472):
```typescript
// REMOVER ESTE BLOCO:
{customFields.map((field) => (
  <TableCell key={field.id} className="text-center">
    {accountId && (
      <FieldValueEditor
        field={field}
        clientId={client.id}
        accountId={accountId}
        currentValue={fieldValues[client.id]?.[field.id]}
        onValueChange={(fieldId, newValue) => handleFieldValueChange(client.id, fieldId, newValue)}
      />
    )}
  </TableCell>
))}
```

### 3. Corrigir colSpan (linhas 2103 e 2110):
```typescript
// DE:
colSpan={5 + customFields.length}

// PARA:
colSpan={9}
```

## Resultado Esperado

A tabela terá apenas as 9 colunas fixas:

| # | Coluna |
|---|--------|
| 1 | Cliente (sticky) |
| 2 | Produto |
| 3 | Contrato |
| 4 | Roizômetro |
| 5 | E-Score |
| 6 | Conexão |
| 7 | V-NPS |
| 8 | Responsável |
| 9 | Ação |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Clients.tsx` | Remover mapeamento de campos personalizados e ajustar colSpan |

## Nota Sobre Componentes Não Utilizados

Os componentes `ClientsTable.tsx` e `ClientsTableRow.tsx` já foram modificados anteriormente, mas não estão sendo usados pela página principal. Esses componentes podem ser removidos no futuro ou mantidos para uso posterior, mas não afetam a renderização atual.
