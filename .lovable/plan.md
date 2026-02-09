

# Adicionar Modo Foco e Tela Cheia nos Insights de Vendas

## O que sera feito

Os botoes "Modo Foco" e "Tela Cheia" serao adicionados nas abas de visuais do Insights (setor de Vendas), seguindo o mesmo padrao ja implementado no Dashboard de Gestao e nos dashboards de Marketing. Os botoes aparecerao tanto no dashboard de visuais customizaveis quanto no dashboard especial de WhatsApp/Conversas.

## Como vai funcionar

- Um botao "Modo Foco" (icone de tela) aparecera no header ao lado do botao "Adicionar Visual"
- Ao clicar, um overlay de tela cheia exibe todos os visuais com tipografia ampliada, ideal para TVs e Chromecast
- Dentro do modo foco, um botao de "Tela Cheia" ativa a Fullscreen API nativa do navegador
- Fechar com ESC ou botao X

## Arquivos alterados

### 1. `src/components/insights/InsightsMainContent.tsx`
- Adicionar estados `isFocusMode`, `isFullscreen` e ref `focusModeRef`
- Adicionar listeners de ESC e fullscreen change
- Inserir botao "Modo Foco" ao lado do botao "Adicionar Visual" no header
- Renderizar overlay de modo foco via `createPortal` com header, filtros e grid de visuais (sem drag)

### 2. `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`
- Mesma logica: estados, listeners, toggleFullscreen
- Botao "Modo Foco" no header ao lado do titulo
- Overlay com todo o conteudo do dashboard WhatsApp (Pipeline, Funil, Conversao, Engajamento, etc.)

## Detalhes tecnicos

O padrao de implementacao replica exatamente o existente em `src/pages/Dashboard.tsx`:

- Portal com `z-[9999]` e `bg-background`
- Header do overlay com titulo, botao fullscreen (Maximize2/Minimize2) e botao fechar (X)
- Listener de ESC para fechar o modo foco
- Listener de `fullscreenchange` para sincronizar estado
- No InsightsMainContent, os visuais serao renderizados em um grid CSS simples (sem drag/resize) para exibicao limpa
- No WhatsAppDashboardPanel, todo o conteudo (PipelineCards, SalesFunnelChart, ConversionScoreCards, etc.) sera duplicado dentro do overlay

Imports adicionais em ambos os arquivos: `useRef, useEffect` do React, `createPortal` do react-dom, `Maximize2, Minimize2, X` do lucide-react.
