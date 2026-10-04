# QA mobile — ROY Eternum

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
