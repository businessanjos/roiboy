
# Modo Foco no Dashboard de Operacoes (Gestao)

## Objetivo
Adicionar o botao "Modo Foco" na aba Gestao do Dashboard de Operacoes, replicando o mesmo padrao ja implementado nos dashboards de Social Media (Instagram e TikTok) do Marketing. O modo foco usa React Portals para overlay em tela cheia, ideal para exibicao em TVs via Chromecast.

## O que sera feito

### 1. Adicionar estados e logica de Focus Mode ao `Dashboard.tsx`
- Adicionar estados `isFocusMode` e `isFullscreen` (ja existem imports de `useRef`, `useState`, `createPortal`)
- Adicionar ref `focusModeRef` para o container fullscreen
- Adicionar listener de tecla ESC para sair do modo foco
- Adicionar listener de `fullscreenchange` para sincronizar estado
- Adicionar funcao `toggleFullscreen` usando a Fullscreen API nativa

### 2. Adicionar botao "Modo Foco" no header do Dashboard
- Inserir um botao com icone `Maximize2` ao lado dos botoes "Atualizar" e "Novo Cliente"
- Tooltip: "Modo Foco (ideal para TV)"

### 3. Criar overlay do Modo Foco via React Portal
- Renderizar com `createPortal` direto no `document.body` (z-[9999])
- Conteudo do overlay:
  - Header com titulo "Dashboard Operacional", botao fullscreen e botao fechar (X)
  - Cards de KPI ampliados (Clientes por Produto em grid)
  - Cards de status (Total, Ativos, Cancelamentos, Encerramentos, Congelamentos) com tipografia aumentada (text-4xl) e icones maiores (h-8 w-8)
  - Grafico de Evolucao Mensal
  - Cards de Retencao e Valor Perdido
- Estilo: padding ampliado (p-8), cards com espacamento generoso, fontes maiores para leitura a distancia

## Detalhes Tecnicos

**Arquivo modificado:** `src/pages/Dashboard.tsx`

**Padrao seguido:** Identico ao `SocialMediaDashboard.tsx` (linhas 66-96 para logica, 500-679 para overlay)

**Imports adicionados:** `Maximize2`, `Minimize2`, `X` do lucide-react (alguns ja estao importados)

**Nenhuma nova dependencia** necessaria - usa `createPortal` do React e Fullscreen API nativa do navegador.
