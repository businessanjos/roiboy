
# Plano: Remover Campos Personalizados da Lista de Clientes

## Problema Identificado

Na aba Clientes, a tabela de listagem está exibindo todos os campos personalizados configurados para "mostrar em clientes" (`show_in_clients = true`). Isso resulta em diversas colunas desnecessárias aparecendo entre "Responsável" e "Ação", como:
- Área de atuação
- Qual o Nome e Profissão do seu Cônjuge?
- Data de Nascimento dos Filhos
- E diversos outros campos...

## Locais Afetados no Código

### Arquivo: `src/pages/Clients.tsx`

| Linha | Código | Uso |
|-------|--------|-----|
| 463-469 | `fetchCustomFields()` | Carrega campos com `show_in_clients = true` |
| 2092-2096 | Loop `customFields.map()` | Renderiza cabeçalhos das colunas |
| 2460-2472 | Loop `customFields.map()` | Renderiza células com `FieldValueEditor` |
| 2103, 2110 | `colSpan={5 + customFields.length}` | Calcula span para células de loading/empty |

## Solucao

Remover completamente a renderizacao dos campos personalizados na tabela de clientes:

1. **Remover o loop que renderiza colunas de campos personalizados no cabecalho**
   - Linhas 2092-2096: Deletar o mapeamento que cria `<TableHead>` para cada campo

2. **Remover o loop que renderiza celulas de campos personalizados no corpo**
   - Linhas 2460-2472: Deletar o mapeamento que cria `<TableCell>` para cada campo

3. **Ajustar os colSpan das celulas de loading/empty**
   - Linhas 2103 e 2110: Alterar de `5 + customFields.length` para um valor fixo (9 colunas fixas)

## Resultado Esperado

A tabela de clientes tera apenas as colunas fixas:
1. Cliente (sticky)
2. Produto
3. Contrato
4. Roizometro
5. E-Score
6. Conexao
7. V-NPS
8. Responsavel
9. Acao

Os campos personalizados continuarao funcionando normalmente:
- No formulario de criacao de cliente (já existente)
- Na página de detalhes do cliente (perfil)
- No gerenciador de campos (botao "Campos")

## Codigo a Ser Modificado

### 1. Remover colunas de campos no cabecalho (linhas 2092-2096):
```typescript
// REMOVER ESTE BLOCO:
{customFields.map((field) => (
  <TableHead key={field.id} className="font-medium text-center min-w-[120px]">
    {field.name}
  </TableHead>
))}
```

### 2. Remover celulas de campos no corpo (linhas 2460-2472):
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

### 3. Ajustar colSpan (linhas 2103 e 2110):
```typescript
// DE:
colSpan={5 + customFields.length}

// PARA:
colSpan={9}
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Clients.tsx` | Remover renderizacao de campos personalizados da tabela |

## Impacto

- **Nenhuma perda de funcionalidade**: Os campos personalizados continuam existindo e funcionando
- **Apenas remocao visual da tabela**: A listagem fica mais limpa e focada nos dados essenciais
- **Campos editaveis no perfil**: O usuario pode editar campos personalizados acessando o perfil individual do cliente
