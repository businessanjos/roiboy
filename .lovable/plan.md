

## Diagnóstico: Campanhas 3C Plus incompletas para vendedores

### Causa Raiz Encontrada

Analisei o banco de dados e encontrei **3 integrações 3C Plus** na mesma conta:

| Usuário | Domínio salvo | Token (últimos 6) |
|---------|--------------|-------------------|
| Jonathan Marcato | `https://anjosbusiness.3c.plus/agent` | `c6N1fi` |
| Darlan Ferreira | **NULL** (vazio) | `c6N1fi` |
| João Ferrari | `anjosbusiness.3c.plus/login` | `bF4t8R` |

O **bug é o domínio NULL do Darlan**. Quando o domínio é `null`, a função `getBaseDomain()` retorna o domínio padrão `https://app.3c.fluxoti.com` — que é o endpoint ERRADO para esse token. A API do 3C Plus no domínio errado retorna uma lista diferente (incompleta ou vazia) de campanhas.

O fallback existente no código só tenta `custom → padrão`. Nunca tenta `padrão → custom`. Então quando o domínio é null, ele já ESTÁ no padrão e não tem para onde ir.

### Respostas às suas 4 perguntas

1. **Token no localStorage?** Não. O token está corretamente salvo no banco (`user_integrations`), atrelado ao `user_id`. Sem problemas aqui.

2. **Paginação?** Já implementada (`per_page=100`, loop até 10 páginas). Sem problemas aqui.

3. **Filtros por Role?** Não existe nenhum filtro por role no frontend nem na edge function. As campanhas são retornadas integralmente. Sem problemas aqui.

4. **Cache?** Não há React Query nem cache — é uma chamada direta via `supabase.functions.invoke()` a cada clique. Sem problemas aqui.

### Correção — Edge Function `threecplus-campaigns`

Adicionar **fallback bidirecional**: quando o domínio do usuário é null ou retorna 0 campanhas, buscar o domínio de OUTRA integração 3C Plus da mesma conta que tenha domínio configurado.

**Mudanças na `threecplus-campaigns/index.ts`:**

1. Alterar a query de `users` para incluir `account_id`
2. Após verificar que o domínio é null ou que retornou 0 campanhas, consultar `user_integrations` de outros usuários da mesma conta que tenham domínio configurado no metadata
3. Usar esse domínio como fallback adicional

```text
Fluxo atual:
  domínio do user → fallback domínio padrão → fim

Fluxo corrigido:
  domínio do user → fallback domínio de colega da conta → fallback domínio padrão → fim
```

### Arquivo editado
- `supabase/functions/threecplus-campaigns/index.ts`

