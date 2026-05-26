## Chat de Operação no Sales Dashboard

Adicionar um painel de chat dentro de `/sales-dashboard` onde o gestor "conversa com os dados" da operação comercial. Cada resposta pode ser transformada em um KPI fixo no topo do dashboard.

### 1. UI no Sales Dashboard

- Nova aba **"Pergunte aos Dados"** (ícone Sparkles) ao lado de Metas/Funil/Performance/Equipe/Origem.
- Layout split:
  - Esquerda: histórico de conversas (sessões salvas, renomeáveis, deletáveis).
  - Direita: chat estilo ChatGPT com markdown, streaming token-a-token, indicador "Gemini analisando…" → "GPT gerando insight…".
- Sugestões iniciais: "Qual closer está com pior conversão este mês?", "Quanto perdi em MRR por 'sem fit' nos últimos 30 dias?", "Compare o funil de Maio vs Abril".
- Topo do dashboard: nova faixa **"KPIs fixados"** acima das abas, com cards arrastáveis (remover/ocultar). Vazio por padrão.

### 2. Pipeline de IA (2 etapas)

Edge function `sales-dashboard-chat` (streaming):

1. **Gemini 2.5 Pro — Analista**: recebe a pergunta + snapshot estruturado dos dados de vendas (deals, stages, owners, períodos, motivos de perda, metas, comissões agregadas pelos últimos 12 meses). Retorna JSON com:
   - `analysis`: texto analítico bruto
   - `kpi`: `{ label, value, unit, period, comparison, trend }` quando a pergunta produz um KPI numérico
   - `chart_data` opcional
2. **GPT-5 — Insight**: recebe o JSON do Gemini + a pergunta original. Gera resposta final em markdown com narrativa executiva, contexto, recomendação. Mantém o bloco `kpi` intacto no metadata.

Stream apenas a saída final do GPT para a UI. Metadata (`kpi`, `chart_data`) entregue como evento JSON final.

### 3. Fixar KPI no Dashboard

- Botão **"Fixar como KPI"** aparece sob a resposta quando `kpi` está presente.
- Ao clicar: abre dialog para escolher label/cor/ícone (autopreenchido) e salva em `sales_dashboard_pinned_kpis`.
- KPI fica visível para o usuário que fixou (privado). Opção "Compartilhar com a equipe" torna global.
- Valores são recomputados em background: cada KPI fixado guarda a "pergunta canônica" e roda novamente quando o dashboard é aberto (cache 10min).

### 4. Banco de dados

Novas tabelas:

- `sales_chat_sessions` — title, user_id, last_message_at
- `sales_chat_messages` — session_id, role (user|assistant), content, metadata jsonb (kpi, chart_data, model_used)
- `sales_dashboard_pinned_kpis` — user_id, label, icon, color, question, last_value, last_computed_at, is_shared, position

RLS: gestor vê só suas sessões; KPIs compartilhados visíveis para usuários com acesso ao Sales Dashboard.

### 5. Acesso

Apenas usuários com `hasFullAccess` no SalesDashboard (Jonathan, Maikol, Everton + admins via `isManagementUser`) veem a aba e podem fixar KPIs.

### Detalhes técnicos

- Modelos: `google/gemini-2.5-pro` (análise), `openai/gpt-5` (insight) via Lovable AI Gateway.
- Snapshot de dados montado server-side a partir de queries agregadas (deals + sales_users + loss_reasons + goals + contracts), limitado a 12 meses para caber em contexto.
- Streaming SSE para o texto do GPT; chunk final `event: metadata` traz o objeto KPI.
- Recomputação do KPI fixado: edge function `recompute-pinned-kpi` chamada via React Query no mount do dashboard.