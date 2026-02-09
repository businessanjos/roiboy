
# Corrigir Busca de Clientes - Termos com AND em vez de OR

## Problema
Ao buscar "Ana Carolina", o filtro atual usa OR: retorna qualquer cliente cujo nome contenha "ana" **ou** "carolina". Como "ana" e uma substring de Juliana, Suzana, Mariana, Poliana, Hosana, Janaína, etc., muitos clientes irrelevantes aparecem nos resultados.

## Solucao

Alterar a logica de busca multi-termo de **OR** para **AND** na Edge Function `list-clients`.

### Mudanca

**Arquivo:** `supabase/functions/list-clients/index.ts`

**Antes (OR - qualquer termo basta):**
```text
"Ana Carolina" -> full_name.ilike.%ana% OR full_name.ilike.%carolina%
Resultado: 148 clientes (incluindo Juliana, Suzana, Mariana...)
```

**Depois (AND - todos os termos obrigatorios):**
```text
"Ana Carolina" -> full_name.ilike.%ana% AND full_name.ilike.%carolina%
Resultado: apenas clientes com ambos "ana" E "carolina" no nome
```

### Detalhes Tecnicos

Na secao de busca multi-termo (ao redor da linha 120), trocar de `.or()` para encadear multiplos `.ilike()`:

```text
// Antes:
query = query.or(conditions.join(","));

// Depois:
for (const term of searchTerms) {
  query = query.ilike("full_name", `%${term}%`);
}
```

Isso encadeia filtros AND no Supabase, exigindo que todos os termos estejam presentes no nome.

- Busca de termo unico continua igual (busca em nome, telefone e empresa)
- Ranking por relevancia ja implementado continua funcionando
- Nenhuma mudanca no frontend
