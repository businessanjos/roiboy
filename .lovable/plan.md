
# Adicionar Modo Foco e Tela Cheia nos Insights de Vendas

## O que sera feito

Adicionar os botoes "Modo Foco" e "Tela Cheia" nas abas de visuais do Insights (setor de Vendas), seguindo o mesmo padrao ja implementado no Dashboard de Gestao. Os botoes aparecerao tanto no dashboard de visuais customizaveis quanto no dashboard especial de WhatsApp/Conversas.

## Como vai funcionar

- Um botao "Modo Foco" aparecera no header de cada dashboard de Insights, ao lado do botao "Adicionar Visual"
- Ao clicar, um overlay de tela cheia (portal z-9999) exibe todos os visuais com tipografia ampliada, ideal para TVs/Chromecast
- Dentro do modo foco, um botao de "Tela Cheia" ativa a Fullscreen API nativa do navegador
- Fechar com ESC ou botao X

## Arquivos alterados

### 1. `src/components/insights/InsightsMainContent.tsx`
- Adicionar estados `isFocusMode`, `isFullscreen` e ref `focusModeRef`
- Adicionar listeners de ESC e fullscreen change
- Adicionar funcao `toggleFullscreen`
- Inserir botao "Modo Foco" ao lado do botao "Adicionar Visual" no header
- Renderizar overlay de modo foco via `createPortal` com:
  - Header com titulo do dashboard ativo, botao fullscreen e botao fechar (X)
  - Barra de filtros (InsightsFilterBar)
  - Grid de visuais (InsightsGrid) sem funcionalidade de drag/resize
- Imports adicionais: `useRef, useEffect` do React, `createPortal` do react-dom, `Maximize2, Minimize2, X` do lucide-react

### 2. `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`
- Mesma logica de modo foco: estados, listeners, toggleFullscreen
- Botao "Modo Foco" no header ao lado do titulo
- Overlay com todo o conteudo do dashboard WhatsApp (Pipeline, Funil, Conversao, etc.) em layout ampliado
- Imports: `useState, useRef, useEffect` do React, `createPortal` do react-dom, `Maximize2, Minimize2, X` do lucide-react, `Button` do ui

## Detalhes tecnicos

O padrao de implementacao segue exatamente o existente em `src/pages/Dashboard.tsx`:

```text
// Estados
const [isFocusMode, setIsFocusMode] = useState(false);
const [isFullscreen, setIsFullscreen] = useState(false);
const focusModeRef = useRef<HTMLDivElement>(null);

// Listener ESC
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFocusMode) setIsFocusMode(false);
  };
  document.addEventListener('keydown', handleEsc);
  return () => document.removeEventListener('keydown', handleEsc);
}, [isFocusMode]);

// Listener fullscreen change
useEffect(() => {
  const handler = () => setIsFullscreen(!!document.fullscreenElement);
  document.addEventListener('fullscreenchange', handler);
  return () => document.removeEventListener('fullscreenchange', handler);
}, []);

// Toggle fullscreen
const toggleFullscreen = async () => {
  if (!document.fullscreenElement && focusModeRef.current) {
    await focusModeRef.current.requestFullscreen();
  } else if (document.exitFullscreen) {
    await document.exitFullscreen();
  }
};

// Overlay via createPortal
{isFocusMode && createPortal(
  <div ref={focusModeRef} className="fixed inset-0 z-[9999] bg-background overflow-auto">
    ...conteudo ampliado...
  </div>,
  document.body
)}
```

No overlay do InsightsMainContent, os visuais serao renderizados usando o mesmo componente `ConfigurableVisualCard` em um grid CSS simples (sem drag), para exibicao limpa em modo apresentacao.
