

## Corrigir construcao de URL da API do 3C Plus

### Causa raiz

Os logs revelam que a API do 3C Plus retorna **HTML** (pagina de login) em vez de JSON para alguns usuarios. Isso acontece porque o dominio salvo na integracao inclui caminhos extras como `/agent` ou `/agent/login`.

Exemplo do log:
```
Fetching campaigns from: https://anjosbusiness.3c.plus/agent
URL final: https://anjosbusiness.3c.plus/agent/api/v1/agent/campaigns  (ERRADO)
URL correta: https://anjosbusiness.3c.plus/api/v1/agent/campaigns
```

A funcao `getBaseDomain()` remove `/login` do final, mas **nao remove `/agent`**, `/agent/login`, ou outros caminhos que os usuarios podem ter copiado da URL do navegador.

Como a API retorna status 200 com HTML, o codigo interpreta como "sucesso" e tenta fazer parse do HTML como JSON, resultando em uma lista vazia de campanhas.

### Solucao

Atualizar a funcao `getBaseDomain()` em **ambas** as edge functions para remover qualquer caminho apos o dominio base, garantindo que apenas o dominio raiz seja usado para construir URLs da API.

### Alteracoes

#### 1. `supabase/functions/threecplus-campaigns/index.ts`

Atualizar `getBaseDomain()` para remover caminhos extras:

```text
Antes:
  base = base.replace(/\/login\/?$/, "")

Depois:
  base = base.replace(/\/login\/?$/, "")
  base = base.replace(/\/agent\/?.*$/, "")  // Remove /agent e tudo depois
  base = base.replace(/\/supervisor\/?.*$/, "")  // Remove /supervisor e tudo depois
```

Tambem adicionar validacao para detectar quando a API retorna HTML em vez de JSON:

```text
// Verificar se a resposta e JSON antes de tentar parse
if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
  // Retornar erro claro indicando problema de URL/autenticacao
}
```

#### 2. `supabase/functions/threecplus-call/index.ts`

Aplicar a mesma correcao na funcao `getBaseDomain()` para manter consistencia.

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-campaigns/index.ts` - Corrigir `getBaseDomain()` e adicionar validacao de resposta HTML
- **Editar:** `supabase/functions/threecplus-call/index.ts` - Corrigir `getBaseDomain()` para consistencia

