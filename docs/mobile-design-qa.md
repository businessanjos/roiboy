# QA mobile — ROY Eternum

## Momentos CX — fila compacta
- Painel com previsão por dia em horário de Brasília, próximos destinatários e ranking de dias com mais parabéns.
- Fila e auditoria paginadas, com rolagem interna limitada; controles de minimizar e ampliar sem alterações de dados.
- Previsão de aniversário pendente sem horário é identificada como previsão; agendamentos vencidos não contam como envios de hoje.
- Testes unitários de calendário, ranking e previsão: 3 aprovados. Nenhum envio ou alteração de registro real no QA.
- Playwright autenticado: minimizar/mostrar, ampliar/reduzir e abrir auditoria conferidos; 1280px e 320px sem overflow horizontal (320/320). Compilação automática sem erros.

## Conclusão atual (rodada 4)

**Verificado de fato**
- Tipos (`tsgo`) e `vite build`: saída 0.
- Vitest 16/16: `activeNav` (query, filho mais específico), `clientRoutes`, `MobileTabBar` (1 `aria-current`, colunas reais + Mais, botão "Fechar menu", filho fora dos atalhos → Mais), `useVisualViewportHeight` (teclado aplica/limpa altura; zoom não altera nem rola; desktop nunca aplica).
- Playwright autenticado, só leitura, 390px (Chromium): overflow 390 em /marketing, /marketing/content-hq?tab=redes, /financial/dashboard; foco do menu Mais preso (Tab/Shift+Tab), Esc e Fechar devolvem foco; fecha ao ir para 1440px; discador abaixo do overlay; /setores sem voltar/subtítulo. Matriz das 17 rotas na rodada 2.
- Altura com teclado: `AppLayout` consome `h-[var(--app-vh,100dvh)] lg:h-[100dvh]`; o hook só define a variável quando `visualViewport.height < innerHeight` em largura < 1024 e escala 1; não força scroll.

**Não verificado / limitações**
- Nenhum iPhone físico: teclado virtual, safe areas e rolagem elástica não testados (Chromium não abre teclado; altura com teclado coberta apenas por teste unitário).
- Tabelas largas de RH/Financeiro continuam com rolagem lateral contida.
- Abas com overflow: regra `safe center` sem auditoria visual tela a tela.
- Capturas com dados reais só temporárias e privadas; nenhuma versionada.


## Histórico (rodadas 1–3b)

As seções abaixo registram as rodadas anteriores; valem as conclusões acima quando houver conflito.

## Referências 21st realmente usadas
- **21st.dev — @shadcnui-blocks/tabs-08 "Mobile Navigation Tabs" (MIT)**, fonte baixada de `https://shadcnui-blocks.com/r/tabs-08.json`.
  - **Adaptação visual, não importação**: usamos a estrutura de grade de colunas iguais, ícone sobre rótulo curto e indicador de estado ativo. O código original (Radix Tabs com conteúdo de demonstração) **não** foi copiado: a barra do ROY usa `NavLink`, rotas reais e tokens do design system. Atribuição mantida em comentário em `MobileTabBar.tsx`.
- **news.21st.dev — "React mobile navigation components"**: usado só como referência conceitual (bottom tab bar + bottom sheet "Mais"). Nenhum código importado.
- Conector 21st: **não disponível** neste ambiente; nada foi buscado por integração.
- Bottom sheet: componente `Drawer` existente (Vaul) do projeto.

## Alterações
| Arquivo | O que mudou |
|---|---|
| `src/components/layout/AppLayout.tsx` | `100dvh` no lugar de `h-screen`; espaço inferior só quando a tab bar está visível; RoyZapp mantém navegação própria. |
| `src/components/layout/MobileTabBar.tsx` | Estilo iOS (vidro translúcido, 5 colunas = 4 destinos + Mais), alvos ≥44px, `aria-current`, "Mais" vira bottom sheet (Vaul) com altura máx. 88dvh, rolagem interna, fecha ao navegar, Escape e foco restaurado ao botão. "Mais" fica ativo quando a tela atual não está nos atalhos. Exporta `useMobileTabBarVisible`. |
| `src/lib/navigation/activeNav.ts` (+ teste) | Item ativo único considerando pathname **e** query string. |
| `src/components/layout/MobileAppHeader.tsx` | Botões 44×44 (voltar, busca, notificações, avatar), títulos para Configurações/Tarefas/Áreas, rota profunda volta para a lista do item, rótulos acessíveis. |
| `src/pages/Sectors.tsx` | Cabeçalho compacto ("Olá, nome" + empresa), cards como `<button>` em lista semântica, cantos 20px, sombras suaves, sem linha colorida nem padrão decorativo. |
| `src/index.css` | Fonte do sistema Apple no mobile; inputs 16px vencendo `text-sm`/`text-xs`; diálogos centrais com altura máx. dinâmica e rolagem; tablists roláveis; `.touch-press` com reduced-motion. |
| `tailwind.config.ts` | Sombras `shadow-ios` / `shadow-ios-lg`. |
| `index.html` | Removidos `maximum-scale=1`/`user-scalable=no` (zoom do usuário preservado); `interactive-widget=resizes-content` para teclado. |
| `src/components/royzapp/ZappMessageInput.tsx` | Botões de anexo/áudio 44px no celular, `aria-label` no microfone. Envio/recebimento intocados. |

Fonte de acesso: tab bar, sheet e header continuam usando apenas `useSectorNavItems` / `SidebarContent`. Nenhuma regra de permissão, RLS, auth ou dado foi alterada.

## Checks
- `vitest src/lib/navigation/activeNav.test.ts`: 3/3 passaram.
- Typecheck e build automáticos do ambiente.
- QA visual (Playwright, sessão real somente leitura): `/setores` em 390, 320, 430 e 1440px; `/clients` em 390px; bottom sheet "Mais" aberto, Escape fecha e devolve o foco ao botão "Mais". Sem erros de página.

## Não validado / pendências
- iPhone real (safe areas, teclado com `visualViewport`, scroll elástico) — só emulação Chromium.
- RoyZapp lista/conversa, Financeiro, Marketing, RH, Eventos e Pipeline não tiveram auditoria visual página a página; receberam apenas as correções globais (inputs, diálogos, tabs, tabelas). Próxima rodada: tabelas → cards por módulo.
- Dark mode do novo visual não foi capturado em tela.

---

# Rodada 2 — revisão por módulo (04/10/2026)

Sessão real **somente leitura** (`lovable auth-session --self`), Chromium/Playwright. Nada foi enviado, salvo, ligado ou publicado; o tema escuro foi forçado só no navegador de teste (localStorage local, sem tocar na conta).

## Método
- Script mede `scrollWidth` do documento **e** do container de rolagem `#app-main-scroll` (o shell tem `overflow-hidden`, então medir só o documento escondia problemas — falha da rodada 1).
- Para cada transbordo, um probe lista os elementos que passam da borda sem ancestral com rolagem própria.
- Capturas em ` (só telas sem nomes/telefones de clientes).

## Matriz (largura do conteúdo / viewport)
| Rota | 390 antes | 390 depois | 320 | 390 escuro | 1440 |
|---|---|---|---|---|---|
| /roy-zapp lista + conversa (sem enviar) | ok, discador cobria composer | ok | – | ok | ok |
| /pipeline (lista no celular) | discador cobria topo | ok | ok | ok | ok |
| /leads | discador cobria título | ok | – | – | – |
| /sales-calendar | barra cortada lateralmente | ok (quebra linha) | ok | ok | ok |
| /financial/dashboard, /entries, /recebiveis | ok | ok | ok (entries) | – | – |
| /marketing | "Camadas"/"Novo Evento" cortados | ok | ok | – | ok |
| /rh | ok | ok | – | – | – |
| /rh/collaborators | "Novo Colaborador" fora da tela | ok, CTA no topo | ok | ok | ok |
| /events | 394/390 (ponto do filtro) | ok | ok | – | ok |
| /tasks | 488/390 (paginação) | ok | ok (após datas) | ok | ok |
| /notifications, /settings, /dashboard | ok | ok | – | – | – |
| /clients | 449/390 (paginação) | ok | ok (após grade) | ok | ok |
| /operations/mentoria-ec | ok | ok | – | – | – |

Sem erros de página em nenhuma passada.

## Correções
- **Discador 3C** (`ThreeCPlusPanel`): no celular nasce compacto (ícone + status) no canto inferior direito, acima da barra de abas e do composer; antes ficava no topo cobrindo títulos e botões. Desktop igual.
- **Altura com teclado no iPhone**: novo `useVisualViewportHeight` publica `--app-vh` a partir de `visualViewport` (resize/scroll); **[corrigido na rodada 4: nessa época o shell ainda não consumia a variável]**. `interactive-widget` sozinho não funciona no Safari. Não havia implementação anterior de visualViewport.
- **RoyZapp**: botão Voltar no topo da lista (celular), emoji/+/microfone e controles de gravação com 44px. Envio/recebimento intocados.
- **Colaboradores (RH)**: ações quebram linha, "Novo Colaborador" vira CTA de largura total; voltar duplicado escondido no celular.
- **Calendário Marketing** e **Calendário Vendas**: barras com quebra de linha em vez de cortar; removido `pb-24` duplicado.
- **Paginação Clientes/Tarefas**: no celular mostra "página / total" com setas.
- **Tarefas**: campos De/Até dividem a largura. **Clientes (cartões)**: grade com `min-w-0`.
- **Filtros (`filter-bar`)**: ponto de "filtros ativos" dentro do botão.

## Regressões da rodada 1 conferidas
- Item ativo único com query (`/leads` → só "Leads"); 7/7 testes de navegação passam.
- Menu "Mais": abre, Esc fecha, foco volta ao botão; escolher uma tela fecha e navega.
- Títulos do header corretos nas rotas testadas; tab bar oculta no RoyZapp.

## Checks
- `tsgo --noEmit -p tsconfig.app.json` → código de saída 0.
- `vite build` → código de saída 0.
- `vitest run src/lib/navigation` → 2 arquivos, 7 testes passaram.

## Limitações
- iPhone real não testado: `--app-vh` é validado só por emulação (Chromium não abre teclado virtual).
- Ficha de cliente e kanban do pipeline não foram abertos individualmente nesta passada (sem transbordo na lista).
- Tabelas largas (RH, Financeiro) seguem com rolagem lateral contida, não viraram cartões.
- Modo escuro conferido nas telas listadas; dados do RoyZapp escuro ainda carregando na captura.
- Commit é feito pelo histórico do Lovable.

## Rodada 3 — revisão do commit 72c06fd

| Item | Correção | Evidência |
|---|---|---|
| Colunas fixas `grid-cols-5` | `gridTemplateColumns: repeat(n+1)` com destinos reais + Mais | teste DOM `MobileTabBar.test.tsx` (2 destinos → 3 colunas) |
| `aria-current` automático do NavLink | Barra e SidebarContent usam `Link` com `aria-current` controlado | Playwright 390px: `/marketing/content-hq?tab=redes` → só "Social Media"; sem query → só "Conteúdo"; `/clients/checkpoints` → só "Checkpoints"; drawer → 1 item atual |
| Ativo só entre os 4 atalhos | `resolveActiveTarget` na lista completa do setor, depois mapeia para atalho ou Mais | `/clients/medicos` → nenhum atalho marcado (Mais ativo); testes unitários com `/rh/benefits`, `/clients/medicos` |
| Título do topo por pathname | `MobileAppHeader` usa `pickActiveNavIndex` + `location.search` | teste unitário de query |
| Sem botão de fechar no sheet | `DrawerClose` 44×44 "Fechar menu"; fecha ao mudar rota e ao passar de 1024px | Playwright: fecha pelo botão (0 dialogs); abrir e redimensionar para 1440 → 0 dialogs |
| Sidebar/financeiro com dois atuais | Ativo único via `resolveActiveTarget` (inclui filhos sem permissão) | drawer com 1 `aria-current` |
| Tablist `justify-center` em overflow | `justify-content: flex-start; safe center` só em tablists não verticais | CSS |
| Screenshots com dados | Pasta `docs/mobile-qa/` removida; capturas só temporárias e privadas | — |

Checks: `tsgo` saída 0, `vite build` saída 0, vitest 13/13 (activeNav, clientRoutes, MobileTabBar).
Limitações: iPhone real não testado; abas com overflow conferidas por regra CSS, sem auditoria visual tela a tela.

## Rodada 3b — achados da QA autenticada (390×844)

| # | Rota / item | Origem | Correção | Verificado (localhost, 390px) |
|---|---|---|---|---|
| 1 | /marketing toolbar do calendário | toolbar sem quebra | já em flex-wrap desde a rodada 2 (o preview testado era anterior) | main.scrollWidth = 390 |
| 2 | /marketing/content-hq?tab=redes | ações "Configurar Meta API / Sincronizar / Conectar Novo Perfil" e título + abas Lista/Semanal/Insights sem quebra (`SocialMediaTab`) | `flex-wrap` + `min-w-0` | main.scrollWidth 535 → 390; 1 `aria-current` |
| 3 | Discador 3C no /pipeline | posição salva do desktop reaplicada no celular; `z-[60]` acima do drawer (z-50) | no celular sempre canto inferior direito; `z-40 lg:z-[60]`; estado/chamada intactos | botão em y=612, abaixo do overlay |
| 4 | Foco do menu Mais | foco ficava no gatilho | `onOpenAutoFocus` → "Fechar menu"; trap do Radix | ao abrir: "Fechar menu"; 40 Tab + 5 Shift+Tab sempre dentro do diálogo; Esc e Fechar devolvem foco ao "Mais" |
| 5 | Alerta de divergências /financial/dashboard | ícone, texto e ações na mesma linha | empilhado no celular, ações numa faixa inferior; refresh com aria-label | captura privada temporária |
| 6 | /setores com setor salvo | header mostrava voltar e subtítulo | `isSectors`: título "Áreas", sem voltar/subtítulo | 0 botões "Voltar para as áreas" |

Capturas desta rodada ficaram só em pasta temporária privada (não versionadas).

## Rodada 5 — /gestao-tech e /clients/:id (somente leitura)

| Rota | Origem | Correção | main.scrollWidth 320 / 393 / 1440 |
|---|---|---|---|
| /gestao-tech | filtro 220px + "Novo projeto" sem quebra; cabeçalho "Custos Lovable" ("Registrar custo") | barra `flex-wrap`, filtro flexível no celular; cabeçalho com quebra; tabela segue com rolagem contida | 337→320 / 405→393 / 1168 (sem mudança) |
| /clients/:id | "Reprocessar mensagens faltantes" ao lado do título; data dos eventos `whitespace-nowrap` sem quebra; topo com fotos + dados; cabeçalhos "Perfil do Negócio" e "Checkpoints" | título/ação empilhados no celular (botão largura total); linha do evento com `flex-wrap` e data à direita; topo quebra abaixo das fotos quando falta espaço; cabeçalhos com quebra | 385→320 / 400→393 / 1168 |

Medido com Playwright autenticado, sem clicar em ações. Tipos e build: saída 0.

## Rodada 6 — Clientes mobile refeito (<1024px)

Referências 21st usadas: shadcn Item/Item Group (lista agrupada) e Drawer (painel inferior), ambos MIT, adaptados com `vaul` e componentes existentes.

Arquivos: `src/pages/Clients.tsx` (composição mobile `renderMobileView`, filtros extraídos para `filterFields` compartilhado com desktop; `filterRisk` agora conta em `activeFilterCount` e é limpo por `clearAllFilters`, com chip "Risco (nesta página)" no desktop), `src/components/mobile/MobileListGroup.tsx` (padrão reutilizável: `MobileListGroup`, `MobileListRow`, `MobileIconButtonClass`), `src/components/client/RevenueImportDialog.tsx` (`open`/`onOpenChange` opcionais, reset ao fechar preservado).

Mobile: um só título (header global); linha "Ativos · N ⌄" (4 status com contagem) + "+" (respeita `canCreate`) + "…" (visualização, Atualizar lista = só fetchClients/fetchTabCounts, Campos personalizados, Sincronizar produtos dos contratos, Exportar base CSV/XLSX, Importar clientes CSV, Importar faturamento mensal); busca 44px + Filtros 44px com ponto; resumo + chips removíveis; lista agrupada (avatar 36, nome 16 semibold, produto, alerta financeiro discreto, cidade/telefone, chevron, menu por cliente com Abrir/Mesclar/Excluir — mesmos gates do desktop); paginação só no fim; Drawer com as 10 ordenações, faturamento, período (calendário de 1 mês), todos os filtros, itens por página, rodapé "Limpar tudo"/"Ver N resultados" com safe area e fechar 44px. Desktop ≥1024 inalterado.

Verificado (Playwright, sessão real, somente leitura): 1º cliente em y=209 em 393×852 (≈6 clientes visíveis), também 320/430/768/1023; scrollWidth = largura em todos; 1 h1 visível; dark e light; 1440 sem mudança. Menu "…" abre/fecha com Esc e foco volta ao gatilho; diálogos Importar CSV, Importar faturamento e Novo cliente abrem e cancelam (sem pointer-events preso); troca de status (Hold → Ativos); busca vazia mostra estado vazio com "Limpar busca e filtros"; filtro de risco aparece como chip e "Limpar" o remove (inclusive do armazenamento); período personalizado mostra 1 mês; paginação no fim. Nenhuma importação, sincronização, criação ou exclusão executada. Limitação: sem iPhone físico.

## Rodada 7 — Tarefas e Onboarding CS mobile + acabamentos de Clientes

Arquivos: `src/pages/Tasks.tsx` (cabeçalho mobile `renderTasksMobileHeader`, `TaskMobileList` com a mesma resolução de status da tabela — custom_status_id → concluído legado → padrão — e o mesmo checkbox/`handleStatusChange`; filtros extraídos para `taskFilterItems`, compartilhados entre FilterBar desktop e Drawer mobile; `tasksFiltersActive`/`clearTaskFilters` com a mesma regra), `src/pages/ClientOnboardingHub.tsx` (segmento Clientes/Saúde, menu Atualizar/Configurar etapas, resumo recolhível dos 5 indicadores com as mesmas fontes de `summary`, cards em duas linhas no mobile com `lg:contents` preservando o desktop), `src/pages/Clients.tsx` (aria-label em todos os filtros detalhados; foco volta ao botão de filtros via ref ao fechar por botão ou Esc).

Tarefas mobile: "Todas · N ⌄" (Todas, status personalizados sem cancelados, Atrasadas), + Nova tarefa, … (Lista/Kanban, Exportar só com canExportTasks, Régua, Personalizar status); busca 44 + Filtros (pessoa, tipo, etapa no setor Vendas, negociação, ordenar, datas De/Até, direção, por página); resumo "Pendentes · Atrasadas · Concluídas" com indicadores expansíveis e nota da regra (concluídas por data de conclusão, demais por prazo). Linha: checkbox 44, título, cliente/negócio/lead, status·prazo·prioridade alta/urgente, responsável; menu com Status, Prioridade, Prazo, Conversar, Ver negócio, Editar, Excluir. Tabela continua no desktop.

Verificado (Playwright, sessão real, somente leitura; nenhuma tarefa/cliente alterado):
- Tarefas: 1º item y=221 (393×852) e 228 (320); main.scrollWidth = largura em 320/393/430/768/1023; 1440 inalterado; dark ok; 1 h1. Personalizar status, Régua e Nova tarefa abrem e fecham com Esc (sem pointer-events preso); seletor de status abre; indicadores expandem; Drawer sem combobox sem nome; foco volta a "Filtros" após Esc; menu da linha abre (não acionado); busca vazia mostra estado vazio.
- Onboarding CS: 1º cliente y=221; corrigido estouro de 446px (grid sem min-w-0) → 393/320 = largura; Saúde por etapa sem estouro; Configurar etapas abre/fecha; 1440 inalterado.
- Clientes: 0 combobox sem nome no Drawer; foco retorna ao botão de filtros por "Fechar filtros" e por Esc.
- `tsgo` OK (0), `vite build` completo OK (0; só avisos de chunks grandes preexistentes), vitest navegação/viewport/layout 16/16.
Limitações: sem iPhone físico; Kanban de Tarefas no mobile mantido como estava; filtros do Drawer de Tarefas usam ícone + valor (rótulo acessível, sem legenda visível).

## Rodada 7b — Correções da lista mobile de Clientes (revisão diff 308fa4)
- `src/pages/Clients.tsx`: rótulo do período no Drawer renomeado para "Última atualização" (lógica `applyPeriodParams` com `updated_from/updated_to` inalterada).
- Lista mobile: restaurados os alertas de contrato (`getContractExpiryStatus`: vencido / vence em ≤30d / ≤60d) e formulários pendentes (`pendingFormSends`) numa linha discreta de pendências por cliente, junto ao risco financeiro, com `aria-label` "Pendências: …" e `title` com detalhes. Sem cards altos nem botões extras.
- Verificações: tsgo OK; `vite build` completo OK (apenas avisos de chunks grandes preexistentes); vitest `src/components/layout` + `src/hooks` 45/45 OK.
- Limitação: verificação visual não executada nesta rodada — sessão do navegador de testes não estava disponível (tela de login).

## Rodada 7c — Onboarding CS (achado de QA 393px) + validação final
- Medição real (Playwright, sessão autenticada, somente leitura): `main.scrollWidth == clientWidth` em 320/393/430; botão "Iniciar" termina em x=291 (320px), sem corte; o scrollWidth=435 relatado já tinha sido corrigido na rodada 7 (`min-w-0` na grade). A tabela do orquestrador fica contida no próprio recipiente rolável dentro do `<details>` recolhido.
- `src/pages/ClientOnboardingHub.tsx`: segmento Clientes/Saúde 36→44px; botão de indicadores 32→44px com quebra por item (`whitespace-nowrap`), sem cortar números em 320px.
- Primeiro card em y≈221 (393×852). Nenhum onboarding iniciado nem registro alterado.
- Clientes 393px reconferido com sessão: largura 393, linha de pendências exibida (inadimplência visível; contrato/formulários aparecem quando existem).
- Final: tsgo OK; `vite build` OK (só avisos de chunks preexistentes); vitest layout+hooks 45/45 OK.

## Rodada 7d — Tarefas: legibilidade de concluídas e áreas de toque
- `src/pages/Tasks.tsx` (lista mobile): removido `opacity-60` da linha inteira; concluída indicada por círculo verde com check + título riscado em cor secundária; metadados e menu com contraste normal.
- Concluir/Reabrir: botão `role="checkbox"` com `aria-checked`, área clicável real 44×44 (medido) e visual 20px; mesmo handler (`customStatuses` → `handleStatusChange(UUID)`, follow-up preservado). Conclusão real não testada.
- "Mostrar indicadores": 32→44px (medido).
- 393px: largura 393, primeira tarefa y≈221, 0 linhas com opacidade global. Final: tsgo OK; `vite build` OK; vitest layout+hooks 45/45 OK.

## Rodada 7e — Revisão funcional final de Tarefas (diff 51d454)
- `src/pages/Tasks.tsx`:
  - Menu da lista mobile ganhou "Abrir lead" (`/leads?lead=:id`, só no setor Vendas, como na tabela) e "Abrir cliente" (`/clients/:id`).
  - `handleTaskRowClick`: com negócio carregado abre o detalhe como antes; sem negócio, apenas <1024 abre a edição da tarefa (desktop inalterado). Conclusão/UUID/follow-up intocados.
  - Filtros: só uma composição montada por vez via `matchMedia("(min-width:1024px)")` — `taskFilterItems` no Drawer (<1024) ou na FilterBar (≥1024); `filterLead` continua compartilhado; ao cruzar o breakpoint o popover fecha.
- Verificado (Playwright, sessão real, somente navegação):
  - 393 e 768: 1 gatilho "Negociação" e exatamente 1 campo de busca visível; busca digitada; Esc fecha e o foco volta ao gatilho "Negociação".
  - 1440: 1 gatilho, 1 campo de busca.
  - Tarefa ligada a cliente sem negócio: menu mostra "Abrir cliente" → navegou para `/clients/<id>`; toque na linha abriu a edição e Esc cancelou sem salvar.
- Limitações: "Abrir lead" não exercitado (nenhuma tarefa de lead sem negócio nos primeiros itens); não criei teste unitário dedicado ao popover — coberto pelo teste de navegador acima.
- Final: tsgo OK; `vite build` OK (só avisos de chunks preexistentes); vitest layout+hooks 45/45 OK. Nada publicado; nenhum registro alterado.

## Rodada 8 — Paginação (verificação no navegador, só leitura)
Conta do Everton, Playwright, 393×852, 320×700 e 1440×900: /products ("1–15 de 15"), /rh/collaborators ("1–20 de 20"), /notifications ("1–20 de 50", últimas 50), /leads (rodapé com total da base). Largura do main igual à da tela em todas (sem corte). Nenhum registro alterado. Testes de página 2/limites/reset/vazio/encolher em src/hooks/usePagedList.test.ts. Inventário em docs/pagination-audit.md.

## Rodada 8b — Paginação rodada 2 (só leitura)
393/320/1440: /notifications (paginação no servidor, total completo), /financial/bank-accounts ("1–4 de 4"), /operations/onboarding ("1–31 de 31"), /events/playbooks e /contracts (sem texto de faixa: lista cabe numa página/rodapé compacto). Largura sem corte em todas. Nenhum registro alterado; "marcar todas" não executado.

- **Checkpoints (Clientes)**: Corrigido container de tabela que forçava 609px, causando scroll horizontal excessivo em telas de 393px.
- **Contratos**: Rodapé legado removido. Implementado `PagerFor` padrão que se ajusta a telas pequenas e esconde botões desnecessários quando os dados cabem em uma página (ex: 6 de 6).
- **Playbooks**: Validado estado vazio. O componente de paginação não polui a tela se a lista estiver zerada.
- **Tarefas**: Verificada a faixa "1–20 de 682" em 320px; texto quebra elegantemente ou reduz escala conforme o tema shadcn.

## Rodada 8c (Paginação e Tabelas)
- **Checkpoints (Clientes)**: Navegador 393/320/1440 sem corte: "1–20 de 203" (antes 609px de largura, corrigido).
- **Onboarding**: /operations/onboarding "1–20 de 31" verificado sem corte.
- **Tarefas**: /tasks "1–20 de 682" verificado sem corte; faixa quebra elegantemente.
- **Notificações**: Verificado sem corte.
- **Contratos**: /contracts "1–6 de 6" (rodapé antigo substituído pelo padrão; mostra só a faixa quando cabe numa página).
- **Playbooks**: /events/playbooks com 0 playbooks no banco (estado vazio; rodapé com faixa aparece quando há registros).

## Revisão mobile — setor Vendas (out/2026)

Medição automática no navegador, só leitura, em 393px e 320px. "Pequenos" = botões ou links com menos de 40px de altura.

| Rota | Arquivos principais | Largura da página | Pendências medidas |
|---|---|---|---|
| /sales-team | SalesTeam, QuotasIncentivesTab, QuotasSection, SalesTeamTab | ok | 1 pequeno |
| /sales-dashboard | SalesDashboard (não alterado) | ok | 9 pequenos (abas e filtros de 32–36px) |
| /pipeline | SalesPipeline, DealCard, DealKanbanColumn, DealRulerButton, DealDetailSheet | ok; ficha cabe na tela (392/392 e 319/319) | 0–1 pequeno |
| /leads | Leads | ok | 0 |
| /tasks | Tasks, TaskDialog | ok | 0–3 pequenos |
| /sales-calendar | SalesCalendar (agenda por dia no celular) | ok | 2 pequenos |
| /sales-scripts | SalesScripts | ok | 5 pequenos |
| /products | Products | ok | 0 |
| /clients | Clients | ok | 0 |
| /sales/contracts | SalesDigitalContracts | ok | 0 |
| /sales-team/incentive-presentation | (não alterado) | ok | 13 pequenos |
| /sales-team/spiffs | SpiffsTracking, SpiffsSection, SpiffSpinsHistory | ok | 14–16 pequenos, nos painéis de campanha |
| /insights | InsightsFilterBar (filtros em janela inferior), InsightsMainContent, InsightsDashboardTabs | ok | cerca de 13–18 botões sem nome, dentro dos gráficos |
| /sales/logs | SalesLogs, AuditLogViewer | ok | 0 |
| /insights/goals | InsightsGoals | ok | 2 botões sem nome |

Discador 3C (ThreeCPlusPanel): no celular, o botão de abrir é redondo, com 48px, fica ancorado acima da barra inferior, sem arrastar, e tem nome para leitores de tela. O painel ocupa a largura da tela menos 16px de cada lado (16–304 em 320px). Em 320px, o painel foi aberto só para medir; nenhum login nem chamada foi feito.

Ainda não conferido: computador em 1440px depois desta rodada; abrir e fechar todos os filtros; troca de páginas; arrastar cartões no quadro.

### Fechamento (Produtos, Contratos, Acelerômetro)
- Formulário Novo Produto, aberto e fechado com Cancelar sem salvar, em 393 e 320px: nada passa da largura (367/367 e 294/294); campo Nome com 319 e 246px; abas com 44px, rolando de lado; os dois campos de preço em uma coluna (até 2 a partir de 420px); Criar e Cancelar com 44px e rodapé fixo no fim do formulário. A aba Entregas também cabe na largura.
- Produtos e Contratos: menu de ações de 44px no celular, com Editar, Duplicar e Excluir (Contratos também com Copiar link e Abrir), confirmações preservadas. No computador seguem os ícones.
- Acelerômetro: 4 indicadores em 2 colunas; "Ver fonte ›" continua visível, e a auditoria abre ao tocar no cartão.
- Não conferido: abas Bônus, Contrato e Qualificação MQL do formulário; abertura dos menus e da auditoria; computador em 1440px.

### Fechamento Vendas — pendências reais (após 55fb787)
- SPIFFs: período/datas com rótulo e 44px; Girar, Faixa, vendedor, janela, remover faixa, editar/excluir 44px com nome; detalhamentos (valor/vendas) min 44 com aria contextual; "como funciona?"/"sem dados" por toque (Popover).
- Abas SPIFFs/Metas/Acelerômetro 44px; Apresentar plano/Compartilhar 44px; Gestão: período/datas 44px.
- Scripts: abas principais e de Calls 44px; detalhes, navegação Drive, conectar/importar/carregar mais/PDF/copiar/remover 44px.
- Agenda Mês: célula inteira é botão (≥55px, rótulo com data e nº de eventos, setas do teclado), abre lista do dia com itens 44px; bolinhas decorativas; 7 colunas preservadas em 320 (sem overflow). Ações do detalhe 44px.
- Tarefas: pager e "Carregar mais tarefas" 44px.
- Verificado (393px, dados reais): Apresentação, SPIFFs, Scripts, Agenda, Tarefas, Gestão, Dashboard — 0 controles <40px, 0 botões sem nome; larguras extras só em tabelas/abas com rolagem horizontal própria. Agenda testada em 320/393 (toque, teclado, lista). Tipos OK. Nenhuma ação real disparada.
