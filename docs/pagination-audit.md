# Auditoria de paginação — ROY

Padrão: `src/hooks/usePagedList.ts` (`usePagedList` local / `usePaginationState` servidor com `from/to` para `.range()`), rodapé `src/components/ui/list-pagination.tsx` (`ListPagination`, `PagerFor`: "1–20 de N", anterior/próxima, página X de Y, 20/50/100, alvos 44px no celular). Carga completa sem truncar: `src/lib/fetchAllRows.ts` (lotes de 1000 via `.range()`, ordem estável com desempate por `id`).

Regras: busca/filtros/ordenação antes de paginar; volta à página 1 ao mudar critérios/tamanho (resetKey por valor); página ajustada quando a lista encolhe; sem reset durante loading; KPIs, somas, gráficos, exportações e "selecionar todos" sobre o conjunto completo; ações por ID.

Cobertura medida no código: 127 arquivos usam o hook de paginação; 116 renderizam o rodapé.

## Já paginado (mantido)
Clientes, Tarefas, Contratos, Renovações, TeamOpenItems, ApiKeyHistory, Leads (migrado), MarketingTrafegoPago (ad sets), ConfigurableTable/DrilldownDialog (Insights), EventSuppliers, AttendanceReport, Timeline do cliente ("Carregar mais").

## Paginado nesta rodada (por setor)
| Setor | Listagens | Mecanismo |
|---|---|---|
| Financeiro | Parcelas, Clientes ativos (seleção por página rotulada), Extrato bancário, Alertas, Rentabilidade, Régua (Clientes local; Histórico servidor count+range), Importação (preview), Conciliação de vendas (pendentes/histórico), Recorrentes, Conciliação bancária (pendentes/OFX), Portal prestadores (NFs servidor; prestadores local), Orçamento | local; servidor onde havia `.limit` |
| Vendas | Pipeline modo lista (Kanban intacto), Equipe, Comissão por negócio, Contratos digitais, Templates, Histórico SPIFF (lotes), Call Links, Ranking de closers (tabela completa), Videochamadas (lotes), Ligações 3C Plus e Métricas (lotes, sem corte 400/500), Contatos RoyZapp (dialog), Scripts (4 listas), Insights Metas, Import de leads | local + lotes |
| CS/Clientes | Ficha (ROI, Riscos, Recomendações, Contratos, Agenda com listas independentes), Onboarding orquestrado, Perdas de renovação, Churn, Triagem de contratos, Import de contratos, Momentos CX (lotes), Mentor (eventos próximos/passados, lembretes) | local + lotes |
| Marketing/Eventos | TikTok, Instagram, YouTube, Eventos, Lembretes (lotes), Agência (campanhas, relatórios), Projetos, Agências, Campanhas Meta, Referências, Banco de ideias, Mídia do evento (3 seções independentes), Orçamentos de fornecedor | local + lotes |
| RH | Colaboradores, Parceiros, Prestadores, Vagas, Banco de talentos (servidor), Desligamentos, Propostas, Documentos assinados, Auditoria (servidor), Departamentos/Cargos/Benefícios (por grupo), Reuniões e Alinhamentos, Propostas da vaga, Aniversariantes, PDA (acompanhamentos, documentos, PDI) | local/servidor |
| Admin/Config/Tech | Logs de auditoria (lotes), Segurança (servidor), Auditoria de acesso, Contas, Áreas de atuação, Produtos, Reuniões de liderança, Gestão Tech, Custos Lovable (lotes), Auditoria de vínculo (lotes), Notificações, Equipe (membros/funções), Acesso por setor, Empresas | local/servidor + lotes |

## Não aplicável (decisão)
Gráficos, rankings top-N declarados, KPIs, formulários/wizards, calendários, organogramas, Kanbans (Pipeline, Tarefas, Admissões, Ideias, Materiais, Content HQ), conversas/mensagens RoyZapp (histórico por cursor existente), listas DnD de dashboards, checklist de evento agrupado por categoria, resumos diários de evento, tabelas limitadas pelo tamanho do time (OTE, SPIFF por forma de pagamento, métricas por agente), configs curtas (pools de roleta, perfis comportamentais).

## Limites conhecidos (honestos)
- Notificações: hook compartilhado carrega 50; título diz "últimas 50".
- AttendanceReport: "últimos eventos presenciais" (20) e "Últimos check-ins" (10), já rotulados.
- Busca textual de Segurança aplica-se à página carregada (filtro de tipo é no servidor).
- Departamentos/Cargos/Benefícios paginam por grupo, não por item.
- Drilldown Meta (conjuntos/anúncios) sem paginação (edge function sem range).
- Picker de negócio em "Gerar contrato" usa `.limit(200)` (seletor, não listagem).
- Código morto do Financeiro (DueDateAlerts, CommissionsManager etc.) não alterado.

## Verificação
- `tsgo --noEmit`: OK. `vite build`: OK. `vitest src/hooks src/components/layout`: 52/52 (inclui 7 testes de `usePagedList`: página 2 com IDs distintos, limites, reset por filtro/tamanho, vazio, ajuste ao encolher, sem reset em loading).
- Navegador: ver docs/mobile-design-qa.md (rodada 8).

## Rodada 2 — auditoria independente (base f96af873)

Base compartilhada: `useTablePagination`/`TablePagination` já eram camadas de compatibilidade sobre `usePagedList`/`ListPagination` (sem setTimeout em useMemo; resetKey por valor; botões 44px com nomes PT-BR; select com aria-label; quebra de linha). Corrigido defeito real encontrado por teste: filtrar estando numa página avançada não voltava à página 1 (efeito de ajuste sobrescrevia o reset) — agora usa atualização funcional.
Novo `src/lib/fetchAllRows.ts`: carga em lotes de 1000 via `.range()`, ordem com desempate por `id`, teto de segurança (padrão 50.000).

| Área | Correções desta rodada |
|---|---|
| Tarefas | Kanban com "Carregar mais tarefas" (mesma continuação da lista). Busca por cliente/lead/negócio mantém até 1000 IDs por relação: os IDs vão na URL do filtro (`in.(...)`) e mais de 1000 UUIDs excederiam o tamanho da URL; termo que casa >1000 nomes é inespecífico — exceção justificada. |
| Ficha do cliente | Linha do tempo busca registros anteriores no servidor por fonte ("Carregar registros anteriores") até esgotar; respostas de formulário e relatório de checkpoints paginados; check-ins individuais (200) e painel agregado (5000) em lotes. |
| CS/Vendas | Onboarding (50/500) completo e paginado; Clínica Ryka (3000), VIP, Contratos digitais, Contratos (teto 1000), Renovações (2000) em lotes; "Gerar contrato" com busca no servidor. |
| Financeiro | Contas bancárias, Centros de custo, Formas de pagamento, FAQ (categorias/busca), Modelos de lançamento, Comissão por consultor, Ficha do contrato, Linha do tempo da parcela, Pendentes de classificação paginados; Pluggy por conta + contagem 24h sem limite; Kanban de cobrança com "Carregar mais" por coluna (totais e arrastar sobre o conjunto completo). Seleção global preservada. DRE/DRF/Balanço/Fluxo não paginados (estruturais). |
| RH | Todas as fontes `select` sem range trocadas por lotes (colaboradores, prestadores, parceiros, departamentos, cargos, benefícios, vagas, admissões, modelos, docs assinados, desligamentos, candidatos do Kanban). Árvores e grupos preservados. |
| Marketing | Meta: função segue `paging.next` (campanhas/conjuntos/anúncios) e histórico de orçamento em lotes; conjuntos do Tráfego Pago e atribuição de UTM (leads/negócios) em lotes; Formulários, Typeform, Rebranding (fonte), Checklist (50), Briefings, Pilares, Copy (100), Tendências (200), Hooks (200), Concorrentes, Pesquisa (30), Solicitações (20/coluna + carregar mais), listas do projeto paginadas e seletores com busca no servidor; "+N" do calendário abre lista do dia. Tarefas de marketing com ordem manual/DnD: fonte completa, sem pager (exceção). |
| Eventos | Playbooks (catálogo e itens), Lembretes e Resumos paginados; relatório de presença com todos os eventos e exportação completa; ROI busca todas as edições antes de filtrar. Checklist e Design por categoria (agrupados, fonte completa). |
| Admin/Config | Histórico de acesso do usuário (servidor); busca de Segurança no servidor; Notificações: página com paginação no servidor, contagem de não lidas e "marcar todas" no servidor (não executado em QA); Campanha de formulário, Sessões, Tokens, Motivos de perda, Base IA (docs/correções), Perfis, Matriz RoyZapp, Agentes Ever, Métricas RoyZapp (lotes até 50.000, documentado). Logs de auditoria: lotes com teto 20.000 e confirmação antes de exportar. TeamOpenItems mantém export da página (-pN.csv). Conversas Ever: iframe externo, navegação do próprio produto. |

Verificação rodada 2: tsgo OK; vite build OK; vitest hooks+lib+layout 155/155, incluindo `src/lib/fetchAllRows.test.ts` (fixture de 2537 linhas: 3 lotes sem duplicar/truncar, erro parcial, página 2 com IDs distintos, última página, filtro na página avançada volta à 1 com total correto).

### Varredura final de `.limit()` restantes
Corrigidos com lotes/servidor: envios com falha (24h), opções de filtro de Clientes, comissão por negócio, analytics de formulário, TAM/SAM/SOM, snapshots de mercado, tendências do Instagram, Gestão Tech (snapshots), NPS do Dashboard e do incentivo CS, auditoria de produto, script ideal (taxa), responsáveis de renovação, régua do RoyZapp (paginada), negócios excluídos (servidor), detalhamento de métrica (paginado).
Mantidos com justificativa: seletores com busca (filtros do RoyZapp 500, links de call, valores de filtro do Insights 1000, amostra de setores), resumos "próximos/últimos N" (Dashboard, timeline PDA), amostra proposital do gerador de script, busca de IDs em Tarefas (limite de URL), fila e histórico de conversas do RoyZapp (cursor/realtime próprio), ferramentas MCP de análise somente leitura.
