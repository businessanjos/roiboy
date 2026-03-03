

## Corrigir Vendedor e Descrição Detalhada na OS do Omie

### Problemas

1. **Vendedor**: O campo `nCodVend` no `Cabecalho` da OS aceita apenas um **integer** (código do vendedor no Omie). O sistema precisa buscar o vendedor no Omie pelo nome do responsável do negócio (via `ListarVendedores`) e enviar o `codigo` correspondente.

2. **Descrição Detalhada (Item da Venda)**: Quando o mapeamento aponta para o campo personalizado "Item da Venda" (ID: `033b91fb-3add-4c96-aec9-567fefbd0fb2`), o `value_text` armazena o **UUID do produto**, não o nome. O sistema precisa consultar a tabela `products` para resolver o nome do produto antes de enviar como `cDescServ`.

### Alterações — `supabase/functions/create-omie-os/index.ts`

**1. Nova função: buscar vendedor no Omie pelo nome**
```typescript
async function findOmieVendedorByName(appKey, appSecret, name) {
  // Chama ListarVendedores e busca pelo nome (case-insensitive, parcial)
  // Retorna o `codigo` (integer) do vendedor encontrado, ou null
}
```

**2. Resolver nome do produto quando `descricao` vem de campo "Item da Venda"**
- Após resolver `descricao` via `resolveFieldValue`, verificar se o valor parece ser um UUID (produto)
- Se for UUID, consultar a tabela `products` no Supabase para obter o `name` do produto
- Usar o nome do produto como `cDescServ`

**3. Adicionar `nCodVend` ao Cabecalho**
- Chamar `findOmieVendedorByName` com o nome do responsável
- Se encontrar, adicionar `nCodVend: codigoVendedor` ao `Cabecalho`
- Se não encontrar, continuar sem o campo (sem erro, o vendedor fica nas observações)

### Resumo das mudanças
- 1 nova função auxiliar (`findOmieVendedorByName`)
- Lógica de resolução de UUID → nome do produto para `descricao`
- Inclusão condicional de `nCodVend` no `Cabecalho`
- Arquivo: `supabase/functions/create-omie-os/index.ts`

