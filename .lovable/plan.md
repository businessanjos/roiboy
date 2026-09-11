# Botões do menu lateral que parecem "travados"

## O que está acontecendo

Os itens do menu lateral (Fichas, Briefing, Campos, Metas & Vendas, Momentos CX, etc.) **funcionam**: eles trocam o conteúdo da página. O problema é que o conteúdo trocado fica bem abaixo do que aparece na tela.

Na ficha do cliente, antes da área que muda existem: o cabeçalho grande do cliente, os alertas de risco, o aviso de ficha preenchida e um bloco de "Perfil do Negócio" que aparece sempre. Em nenhum lugar do app a página volta para o topo quando o item é clicado, e a posição da rolagem também não muda. Resultado: a pessoa clica, nada se mexe na tela e parece que o botão não faz nada.

Isso não é exclusivo do Marketing: o mesmo padrão está na ficha do cliente, na Administração e nas Configurações, que usam o mesmo tipo de menu lateral.

## O que será feito

1. **Voltar ao topo ao clicar**: ao escolher qualquer item do menu lateral (ficha do cliente, Administração, Configurações) ou qualquer aba do Marketing, a área de conteúdo rola para o topo, mostrando imediatamente a seção escolhida.
2. **Destaque da seção aberta**: título da seção escolhida visível logo no topo do conteúdo, para dar retorno visual claro de que a troca aconteceu.
3. **Fim da duplicação na ficha do cliente**: o bloco "Perfil do Negócio", hoje repetido no topo de todas as seções, passa a aparecer só na Timeline. Assim o item "Perfil do Negócio" do menu deixa de parecer sem efeito.
4. **Mobile**: ao tocar num item, o menu fecha (já fecha hoje) e a nova seção aparece no topo, sem precisar rolar.

## Detalhes técnicos

- A área rolável é o `<main>` em `src/components/layout/AppLayout.tsx`. Será marcada com um `id`/`data-` estável e exposto um helper (`src/lib/navigation/scrollMain.ts`) que rola esse contêiner para o topo com comportamento suave, com fallback para `window.scrollTo`.
- Chamar esse helper em:
  - `src/components/layout/ClientDetailSidebarNav.tsx` (`handleTabChange`)
  - `src/components/layout/SettingsSidebarNav.tsx`
  - `src/components/layout/AdminSidebarNav.tsx`
  - `src/components/marketing/_shared/MarketingTabsHub.tsx` (`handleChange`)
- Em `src/pages/ClientDetail.tsx`: renderizar `<ClientBusinessProfile variant="card" />` apenas quando `tab` for `timeline` (hoje é incondicional na linha ~2645) e adicionar um cabeçalho curto da seção ativa acima do bloco `switch`.
- Nenhuma mudança em regras de acesso, dados ou edge functions; só navegação e apresentação.
