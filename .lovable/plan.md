

## Corrigir nome do campo na API de login de campanha

### Causa raiz

Os logs mostram que a API do 3C Plus retorna erro 422 de validacao:

```
"errors": {
  "campaign": ["O campo Campanha e obrigatorio quanto group id nao esta presente."],
  "group_id": ["O campo group id e obrigatorio quanto Campanha nao esta presente."]
}
```

O codigo envia `{ campaign_id: 52640 }` mas a API espera `{ campaign: 52640 }`. O nome do campo esta errado.

### Correcao

#### `supabase/functions/threecplus-call/index.ts` (linha 108)

Alterar de:
```
body: JSON.stringify({ campaign_id })
```

Para:
```
body: JSON.stringify({ campaign: campaign_id })
```

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-call/index.ts` - Corrigir nome do campo de `campaign_id` para `campaign` no body do POST de login
