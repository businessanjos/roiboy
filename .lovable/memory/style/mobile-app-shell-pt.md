---
name: Mobile app shell
description: Shell mobile estilo app nativo — header compacto, bottom tab bar, PWA instalável e ajustes de safe-area
type: design
---

# Shell mobile (estilo app)

- `MobileAppHeader.tsx` (lg:hidden, sticky): botão voltar aos setores, título da rota atual + nome do setor, sino de notificações e avatar (abre /settings). `GlobalHeader` fica oculto abaixo de `lg`.
- Visual iOS: fonte do sistema Apple no mobile, cards 18–24px, `shadow-ios`, alvos ≥44px, zoom do usuário liberado.
- `MobileTabBar.tsx` (lg:hidden, fixed bottom): até 4 destinos do setor + "Mais" (bottom sheet Vaul com a sidebar completa). Ativo único via `pickActiveNavIndex` (path + query). Adaptação visual do 21st tabs-08. Oculta em `/setores`, `/`, `/auth`, `/choose-plan`.
- `useSectorNavItems.ts` é a **fonte única** de itens de navegação filtrados por permissão/cargo/exceções nominais — usada pela sidebar desktop e pela tab bar. Nunca duplicar essa lógica.
- `AppLayout` usa `100dvh`; padding inferior do `main` só quando `useMobileTabBarVisible()`.
- PWA instalável: `public/manifest.json` (standalone, start_url `/setores`, theme `#efede6`), ícones `icon-192/512.png` e `apple-touch-icon.png`. Sem service worker (não há suporte offline).
- `index.html` usa `viewport-fit=cover, interactive-widget=resizes-content` (sem bloquear zoom); CSS global tem `.pt-safe`/`.pb-safe`, inputs a 16px no mobile (evita zoom do iOS) e `overscroll-behavior-y: none`.
- Pipeline no celular abre em **modo lista** por padrão; o kanban usa colunas de 78vw com scroll-snap.
