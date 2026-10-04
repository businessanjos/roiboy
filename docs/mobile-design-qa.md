# QA de design mobile — ROY Eternum

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
- Capturas em `docs/mobile-qa/` (só telas sem nomes/telefones de clientes).

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
- **Altura com teclado no iPhone**: novo `useVisualViewportHeight` publica `--app-vh` a partir de `visualViewport` (resize/scroll); o shell usa `h-[var(--app-vh,100dvh)]`. `interactive-widget` sozinho não funciona no Safari. Não havia implementação anterior de visualViewport.
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
