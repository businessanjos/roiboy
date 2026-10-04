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
