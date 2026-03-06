

## Plano: Exibir telefones adicionais na busca por nome no "Nova Conversa"

### Problema raiz

A tabela `clients` também possui `additional_phones`, mas a query de clientes no `searchContacts` não inclui esse campo no `select`. Além disso, se o Lead "Teste" foi convertido a Cliente, a query de leads o ignora (filtro `converted_to_client_id is null`), perdendo os telefones adicionais.

### Correção — `src/pages/RoyZapp.tsx`

**1. Incluir `additional_phones` no select de clientes** (linha 3069):
```typescript
.select("id, full_name, phone_e164, avatar_url, status, additional_phones")
```

**2. Expandir telefones adicionais dos clientes** (após linha 3136):
Aplicar a mesma lógica de expansão que já existe para leads — para cada cliente com `additional_phones`, gerar entradas extras com o sufixo `-alt-` no ID e o telefone adicional como `phone_e164`.

**3. Garantir ordenação próxima**: Como as entradas extras são inseridas logo após a entrada principal no array (antes da deduplicação), elas aparecerão naturalmente adjacentes na lista de resultados, que é exatamente o que o usuário quer — o número adicional aparecendo logo abaixo do principal.

### Arquivo alterado
- `src/pages/RoyZapp.tsx`

