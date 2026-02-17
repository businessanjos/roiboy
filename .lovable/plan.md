

## Remover restricao de pais no campo de localizacao "Cidade"

### Problema

O componente `LocationAutocomplete` restringe buscas apenas ao Brasil atraves do parametro `&countrycodes=br` na chamada a API do Nominatim (linha ~119 de `LocationAutocomplete.tsx`).

### Solucao

Remover o parametro `countrycodes=br` da URL de busca, permitindo resultados globais (cidades, estados, paises de qualquer lugar do mundo).

### Mudanca

**`src/components/custom-fields/LocationAutocomplete.tsx`**

Linha da URL atual:
```
`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=br`
```

Nova URL (sem restricao de pais):
```
`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`
```

Apenas a remocao de `&countrycodes=br`. Nenhuma outra mudanca necessaria — o formatador de endereco e os demais componentes ja funcionam com dados internacionais.

