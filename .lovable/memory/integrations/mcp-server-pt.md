---
name: Servidor MCP do ROY (Claude/ChatGPT)
description: Servidor MCP roy-eternum com OAuth por usuário expondo 3C Plus, pipeline, metas/comissões e RoyZapp
type: feature
---
- Código em `src/lib/mcp/` (`index.ts` = defineMcp, `tools/*`, `supabase.ts`, `helpers.ts`). Função gerada em `supabase/functions/mcp/index.ts` (auto-gerada pelo `mcpPlugin()` no vite.config — nunca editar à mão).
- Auth: OAuth 2.1 do Supabase por usuário (`auth.oauth.issuer`), RLS aplicada com o token do usuário. Cada gestor conecta a própria credencial.
- Tela de consentimento: `/.lovable/oauth/consent` (`src/pages/OAuthConsent.tsx`). `/auth?next=` preserva o retorno, inclusive no login Google.
- Ferramentas (somente leitura): `telephony_calls`, `sales_deals`, `sales_goals_commissions`, `zapp_conversations`, `zapp_messages`.
- A função MCP só vai ao ar no publish do projeto.
