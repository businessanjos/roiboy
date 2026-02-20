

## Corrigir URL da API 3C Plus na Edge Function

### Causa raiz

A URL do endpoint esta incorreta. O codigo atual chama:

```
https://app.3c.fluxoti.com/api/v1/user/me
```

Mas o endpoint correto (confirmado pelo SDK oficial da 3C Plus no GitHub) e:

```
https://app.3c.fluxoti.com/api/v1/me
```

O `/user/` extra no caminho faz a API retornar 404 ("recurso nao encontrado"), que e exatamente o erro que voce esta vendo.

### Correcao

Alterar uma unica linha no arquivo `supabase/functions/threecplus-auth/index.ts`:

**Antes:**
```
fetch("https://app.3c.fluxoti.com/api/v1/user/me", { ... })
```

**Depois:**
```
fetch("https://app.3c.fluxoti.com/api/v1/me", { ... })
```

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-auth/index.ts` - Corrigir URL do endpoint (1 linha)

