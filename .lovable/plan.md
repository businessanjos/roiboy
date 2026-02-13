

## Adicionar campo "Proprietario" dinamico no detalhe do Lead

### Conceito
O campo "Proprietario" nao sera um campo salvo no lead -- ele sera calculado dinamicamente a partir do **vendedor responsavel pelo negocio mais recente** vinculado ao lead. Se nao houver negocios, o campo nao aparece.

### Mudancas

**Arquivo: `src/components/leads/LeadDetailSheet.tsx`**

1. Alterar a query de deals (linha 191-195) para tambem buscar `responsible_user_id` e o nome do usuario responsavel via join:
```text
.select("id, title, value, responsible_user_id, stage:deal_stages(name), responsible:users!deals_responsible_user_id_fkey(name)")
```

2. Adicionar uma variavel derivada `ownerName` que pega o nome do responsavel do primeiro deal (mais recente, ja que a query ordena por `created_at desc`)

3. Exibir na secao de informacoes de contato (entre a origem e a data de criacao) um item com icone `User` mostrando "Proprietario: Nome do Vendedor"
   - Estilo igual aos outros campos de contato (icone + texto)
   - So aparece se existir pelo menos um deal com responsavel

### Interface Deal
Atualizar a interface `Deal` local para incluir:
- `responsible_user_id?: string | null`
- `responsible?: { name: string } | null`

### Comportamento
- Somente leitura, sem edicao
- Atualiza automaticamente quando o lead e aberto (recalculado a cada abertura)
- Se o negocio mais recente nao tiver responsavel, nao exibe o campo
