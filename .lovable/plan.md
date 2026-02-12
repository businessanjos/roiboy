
## Zoom individual para cada janela com Modo Foco

### O que sera feito

Cada overlay de "Modo Foco" tera um controle de zoom independente (slider de 50% a 200%), permitindo ajustar o tamanho do conteudo individualmente em cada tela/monitor sem afetar as outras janelas do ROY.

### Como vai funcionar

- Um slider de zoom aparece no header do Modo Foco, entre os botoes existentes
- O zoom aplica `transform: scale(X)` no container de conteudo, com `transform-origin: top center`
- Cada janela mantem seu proprio estado de zoom, independente das outras
- O valor padrao e 100%
- Botoes de + e - para ajuste fino, alem do slider

### Detalhes tecnicos

**Novo arquivo:** `src/components/ui/zoom-controls.tsx`

Componente reutilizavel com:
- Slider (range 50%-200%, step 10%)
- Botoes ZoomIn/ZoomOut
- Label com porcentagem atual
- Props: `zoom`, `onZoomChange`

**5 arquivos modificados** (adicionar zoom ao Modo Foco de cada um):

| Arquivo | Janela |
|---------|--------|
| `src/pages/Dashboard.tsx` | Dashboard Operacional (Gestao) |
| `src/components/insights/InsightsMainContent.tsx` | Insights / Leaderboard |
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | WhatsApp Dashboard |
| `src/components/marketing/TikTokDashboard.tsx` | TikTok Dashboard |
| `src/components/marketing/SocialMediaDashboard.tsx` | Social Media Dashboard |

Em cada arquivo:
1. Adicionar estado `const [zoom, setZoom] = useState(100)`
2. Inserir `<ZoomControls zoom={zoom} onZoomChange={setZoom} />` no header do overlay
3. Envolver o conteudo do overlay com `<div style={{ transform: \`scale(${zoom / 100})\`, transformOrigin: 'top center', width: \`${10000 / zoom}%\` }}>` para manter o conteudo centralizado e responsivo ao zoom

A propriedade `width` compensatoria garante que ao dar zoom-out (ex: 70%) o conteudo se expanda para preencher a tela, e ao dar zoom-in (ex: 150%) o conteudo se reduza proporcionalmente, evitando espacos vazios ou overflow horizontal.
