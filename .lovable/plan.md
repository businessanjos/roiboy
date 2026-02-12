

## Corrigir layout e zoom no Modo Foco dos Insights

### Problema 1: Layout nao preservado

O Modo Foco renderiza os visuais em um grid CSS simples (`grid-cols-2`), ignorando completamente as posicoes salvas no `InsightsGrid`. Por isso o "Ranking de Vendedores" aparece lado a lado com o "Calls Comerciais" no Modo Foco, mas na visualizacao normal um fica acima do outro.

### Problema 2: Zoom causa corte nos visuais

O `transform: scale()` escala visualmente mas nao altera o tamanho real do elemento no layout. O container pai nao sabe que o conteudo cresceu, causando overflow oculto e partes dos visuais cortadas.

### Solucao

**1. Usar `InsightsGrid` no Modo Foco (somente leitura)**

Substituir o grid CSS simples pelo componente `InsightsGrid` real, porem com drag/resize desabilitado. Isso preserva exatamente o posicionamento configurado pelo usuario.

Adicionar uma prop `readOnly` ao `InsightsGrid` que desabilita drag e resize.

**2. Usar CSS `zoom` ao inves de `transform: scale()`**

A propriedade CSS `zoom` altera o tamanho real de layout do conteudo. O browser recalcula o fluxo, scroll e dimensoes automaticamente -- nenhum conteudo fica oculto. Isso se aplica a todos os overlays de Modo Foco (Insights, WhatsApp, Dashboard, TikTok, Social Media).

### Detalhes tecnicos

**Arquivo 1:** `src/components/insights/grid/InsightsGrid.tsx`

- Adicionar prop opcional `readOnly?: boolean`
- Quando `readOnly=true`, desabilitar drag e resize no `GridLayout`

**Arquivo 2:** `src/components/insights/InsightsMainContent.tsx`

- No Modo Foco, substituir o `<div className="grid grid-cols-2">` pelo `<InsightsGrid visuals={visuals} onLayoutChange={() => {}} readOnly />` 
- Trocar `transform: scale()` por `zoom: focusZoom / 100` no container de conteudo

**Arquivos 3-5:** Aplicar a mesma troca de `transform: scale()` para `zoom` nos demais overlays:
- `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/marketing/TikTokDashboard.tsx`
- `src/components/marketing/SocialMediaDashboard.tsx`

### Mudanca de estilo (em todos os overlays)

```text
// ANTES (causa corte):
style={{ 
  transform: `scale(${zoom / 100})`, 
  transformOrigin: 'top center', 
  width: `${10000 / zoom}%` 
}}

// DEPOIS (zoom real sem corte):
style={{ zoom: zoom / 100 }}
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/grid/InsightsGrid.tsx` | Adicionar prop `readOnly` |
| `src/components/insights/InsightsMainContent.tsx` | Usar `InsightsGrid readOnly` + CSS `zoom` |
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | CSS `zoom` |
| `src/pages/Dashboard.tsx` | CSS `zoom` |
| `src/components/marketing/TikTokDashboard.tsx` | CSS `zoom` |
| `src/components/marketing/SocialMediaDashboard.tsx` | CSS `zoom` |

