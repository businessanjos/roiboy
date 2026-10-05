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
