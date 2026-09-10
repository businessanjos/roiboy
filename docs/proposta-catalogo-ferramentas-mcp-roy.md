# Proposta: Catálogo de Ferramentas MCP para Análises Amplas do ROY no Claude

> Status: proposta (nenhuma alteração de código/schema foi feita). Objetivo: ampliar o conector MCP existente (`supabase/functions/mcp`, definido em `src/lib/mcp/`) para cobrir mais domínios do ROY, mantendo os princípios já adotados: **somente leitura**, **execução com o token do usuário conectado** (`supabaseForUser`, RLS do Postgres aplica-se integralmente) e **sem SQL livre**.

## Princípios de design (mantidos do padrão atual)

1. **Sem ferramenta SQL genérica.** Cada ferramenta expõe uma pergunta de negócio específica, com schema de entrada tipado (zod) e uma query fixa/parametrizada — nunca uma string SQL vinda do modelo.
2. **Zero mutação.** Todas as ferramentas são `SELECT`; `annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }` em todas.
3. **Permissão = a do usuário logado.** O client Supabase é criado com o JWT do usuário (`supabaseForUser`), então toda RLS/policy do Postgres já filtra automaticamente por conta, setor, papel etc. O catálogo abaixo **não recria** regras de autorização — apenas garante que os campos selecionados não vazem dados que a RLS não bloquearia mas que são sensíveis por natureza (ver seção "Dados sensíveis").
4. **Limites obrigatórios em toda ferramenta:** paginação com `limit` (máx. sugerido 200–500), período obrigatório ou default curto (ex.: últimos 30 dias) quando a tabela é de alto volume (ligações, mensagens), e resposta sempre com bloco de **resumo agregado** + lista detalhada truncável, sinalizando truncamento (`observacao`).
5. **Nomenclatura por domínio de negócio**, não por tabela crua, para ficar auto-descritivo ao Claude e para podermos trocar a tabela/fonte por baixo sem quebrar o contrato.

---

## Catálogo proposto por domínio

### 1. Vendas / Pipeline (já existe parcialmente)
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| `sales_deals` ✅ existente | período, status, busca, limit | resumo (conversão, valores) + lista de negócios | limit ≤ 500 | valores comerciais, dados de contato (nome/email/telefone do lead) |
| `sales_goals_commissions` ✅ existente | período, flags de incluir metas/comissões, limit | metas do período + comissões por negócio | limit ≤ 500 | comissão individual = dado de remuneração |
| **`sales_pipeline_funnel`** (novo) | período, `pipeline_id?`, `responsible_user_id?` | contagem/valor por estágio, taxa de passagem entre estágios, tempo médio por estágio | agregado apenas, sem lista de negócios | nenhum dado pessoal, só agregados |
| **`sales_team_performance`** (novo) | período, `team_id?` | ranking de vendedores: negócios criados, ganhos, ticket médio, taxa de conversão, tempo médio de resposta | agregado por vendedor, sem detalhe de negócio | comparação entre pessoas — restringir a quem tem papel de liderança (RLS deve já limitar `deals`/`sales_goals` por hierarquia; validar antes de liberar) |
| **`sales_lost_reasons`** (novo) | período, `stage_id?` | distribuição de motivos/sub-motivos de perda, valor perdido | agregado | nenhuma |

### 2. Telefonia / 3C Plus (já existe)
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| `telephony_calls` ✅ existente | período (obrigatório), agente, campanha, direção, limit | resumo por vendedor + lista de ligações | limit ≤ 500, período obrigatório | telefone do contato, nome — **não incluir gravação/transcrição** nesta ferramenta |
| **`telephony_call_recording_lookup`** (novo, opcional/restrito) | `call_id` único | metadados da chamada + URL de gravação (se existir) — **não o áudio/texto** | 1 registro por chamada | alto: acesso a gravação de ligação. Recomenda-se manter fora do catálogo padrão ou exigir papel específico (ex.: liderança de vendas) via policy dedicada |

### 3. RoyZapp / Atendimento (WhatsApp) (já existe)
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| `zapp_conversations` ✅ existente | período, busca, incluir grupos, limit | lista de conversas | limit ≤ 200 | telefone/nome de contato |
| `zapp_messages` ✅ existente | `conversation_id`, limit | mensagens da conversa | limit ≤ 200 | **conteúdo de conversa privada** — o mais sensível do catálogo. Manter exigência de `conversation_id` explícito (sem varredura em massa) e considerar mascarar texto se o usuário não for responsável/atribuído à conversa (checar RLS de `zapp_conversation_assignments`) |
| **`zapp_team_metrics`** (novo) | período, `sector_id?`, `agent_id?` | volume de conversas, SLA de primeira resposta, tempo médio de resolução, taxa de reatribuição/transferência | agregado por agente/setor | comparação de performance individual — mesma ressalva de `sales_team_performance` |

### 4. Financeiro
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| **`financial_cashflow_summary`** (novo) | período, `entry_type` (receita/despesa/all), `category_id?` | totais por categoria, entradas x saídas, saldo do período | agregado; se detalhar lançamentos, limit ≤ 200 e sem `attachment_url`/`notes` livres | **alto**: dados financeiros da empresa. Não expor `omie_id`, `openfinance_transaction_id`, anexos (podem conter dados bancários/documentos). Escopo: apenas contas às quais o usuário tem acesso pela RLS de `financial_entries` |
| **`financial_receivables_overview`** (novo) | período, status (pendente/pago/atrasado) | resumo de contas a receber por cliente, inadimplência | agregado, sem exibir dados bancários | nome do cliente + valor devido — moderado |

### 5. RH / Gestão de Pessoas
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| **`rh_headcount_overview`** (novo) | `sector_id?`, `status` (ativo/inativo/all) | contagem por setor/cargo, admissões e desligamentos no período | agregado apenas | moderado: nunca expor salário, dados de folha ou documentos pessoais nesta ferramenta |
| **`rh_incentive_summary`** (novo, se aplicável a papel do usuário) | período, `plan_id?` | totais de bônus/incentivo por plano (agregado, não por pessoa, salvo se o usuário for o próprio beneficiário) | agregado por padrão | **alto**: remuneração variável. Exigir que detalhamento por pessoa só apareça se `auth.uid()` = beneficiário ou papel de liderança/RH (delegar à RLS existente; não fazer bypass) |

### 6. Clientes / Sucesso do Cliente (CS)
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| **`clients_portfolio_overview`** (novo) | `status` (ativo/renovação/churn/all), `cs_owner_id?` | contagem, MRR/valor de contrato, distribuição por status, próximos vencimentos de contrato | agregado + lista resumida (nome, status, valor, data), limit ≤ 300 | dados comerciais de clientes — moderado |
| **`clients_health_and_renewals`** (novo) | período de vencimento, `risk_level?` | lista de clientes com risco de churn / próximas renovações e checkpoints pendentes | limit ≤ 200 | moderado |

### 7. Marketing
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| **`marketing_campaign_performance`** (novo) | período, `channel?`, `campaign_id?` | leads gerados, custo, conversão por campanha/canal | agregado | baixo |
| **`marketing_content_calendar_status`** (novo) | período | status de publicações planejadas x publicadas por rede | agregado/lista curta | baixo |

### 8. Eventos
| Ferramenta | Entrada | Saída | Limite | Sensibilidade |
|---|---|---|---|---|
| **`events_overview`** (novo) | período, `status?` | lista de eventos, inscritos, check-ins, fornecedores contratados x orçamento | limit ≤ 200 | baixo/moderado (dados de fornecedores/orçamento) |

---

## Dados sensíveis — regras transversais

- **PII de terceiros** (telefone, e-mail, nome de lead/cliente): permitido nas ferramentas de vendas/CS/atendimento porque já é do dia a dia operacional do usuário autorizado via RLS, mas **nunca em ferramentas agregadas de "overview" cross-conta**.
- **Conteúdo de conversas (RoyZapp)**: tratar como o dado mais sensível; exigir ID explícito da conversa, nunca "buscar todas as mensagens de todos os contatos".
- **Financeiro e remuneração (comissões, bônus, folha)**: agregações por padrão; detalhamento individual só quando o solicitante é o próprio titular ou tem papel de liderança/financeiro — a validação real ocorre via RLS/policy no Postgres, o catálogo apenas evita adicionar `SELECT *` que exponha colunas como `omie_id`, `attachment_url`, dados bancários, `secret_key` (tabela `webhooks`), tokens ou credenciais.
- **Gravações/transcrições de chamadas e vídeo (`video_call_sessions.recording_url/transcription/analysis`)**: excluir do catálogo padrão ou isolar em ferramenta própria com escopo restrito, pois pode conter conteúdo sensível de terceiros.
- **Nunca expor**: `secret_key`, tokens OAuth, `service_role` ou qualquer credencial de integração (`webhooks`, `integrations`).

## Escopo e governança

- **Escopo por conta/tenant**: todas as queries herdam o filtro de conta via RLS (multi-tenant já existente em `financial_entries`, `suppliers` etc.) — não é necessário parâmetro de conta na ferramenta.
- **Escopo por papel**: ferramentas de comparação de performance individual (`sales_team_performance`, `zapp_team_metrics`, `rh_incentive_summary`) devem ser adicionadas somente após confirmar que a RLS das tabelas-fonte já restringe por hierarquia (líder vê o time; vendedor vê só o próprio); caso a RLS ainda não faça essa distinção, é pré-requisito ajustá-la antes de publicar a ferramenta — **não compensar isso na camada MCP**.
- **Escopo temporal**: exigir período com janela máxima recomendada (ex.: 12 meses) nas ferramentas de alto volume para evitar respostas gigantes e custo de leitura.
- **Auditoria**: como o MCP já roda com o JWT do usuário, os acessos ficam auditáveis via log padrão do Supabase/Postgres (RLS + logs de função); recomenda-se também logar no `ai_usage_alerts`/tabela de auditoria existente cada chamada de ferramenta sensível (ex.: financeiro, RH) para rastreabilidade adicional.

## Próximos passos sugeridos

1. Validar com donos de cada domínio (Financeiro, RH, CS, Marketing) quais campos podem sair "por padrão" vs. "sob demanda restrita".
2. Confirmar RLS de `deals`, `commission_deal_entries`, `zapp_messages` e tabelas de RH quanto a escopo hierárquico antes de implementar as ferramentas de "team performance"/"incentive summary".
3. Implementar por domínio, reaproveitando `helpers.ts`/`supabase.ts` atuais, seguindo o padrão de `defineTool` já validado.
4. Adicionar testes de contrato (schema de saída) e um teste manual por ferramenta com usuário de baixo privilégio para confirmar que a RLS filtra corretamente (sem vazamento cross-conta).
