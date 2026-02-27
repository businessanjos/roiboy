

## Corrigir posicionamento do Funil de Vendas no Dashboard WhatsApp

### Problema

Os visuais customizados (incluindo o Funil de Vendas) sao renderizados como uma camada de sobreposicao absoluta (`absolute inset-0 z-10 pointer-events-none`) sobre as secoes do dashboard WhatsApp. Isso causa dois problemas:

1. **Ao filtrar**: o conteudo abaixo muda de altura, alterando o sistema de coordenadas do overlay e deslocando o visual
2. **No modo foco/tela cheia**: o container muda de dimensoes, causando o mesmo deslocamento

Em contraste, os dashboards regulares (InsightsMainContent) renderizam o InsightsGrid em fluxo normal do documento, sem posicionamento absoluto.

### Solucao

Mudar a renderizacao dos visuais customizados de overlay absoluto para fluxo normal do documento, igual aos dashboards regulares. O InsightsGrid sera renderizado apos as secoes nativas, dentro do fluxo normal.

### Alteracao

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

1. **Remover o overlay absoluto** (linhas 139-143): Eliminar o bloco `<div className="absolute inset-0 z-10 pointer-events-none">` que envolve o InsightsGrid

2. **Mover o InsightsGrid para dentro do fluxo normal**: Renderizar o InsightsGrid apos as secoes nativas (apos o fechamento do `<div className="space-y-6">`), dentro do container `relative`, sem posicionamento absoluto

3. **Resultado**: O grid ficara no fluxo do documento, mantendo posicao estavel independente de filtros, modo foco ou tela cheia

### Detalhe tecnico

| Local | De | Para |
|---|---|---|
| Linhas 139-143 | `<div className="absolute inset-0 z-10 pointer-events-none">` com InsightsGrid | Removido |
| Apos linha 236 (fim do space-y-6) | Nada | InsightsGrid em fluxo normal, sem wrapper absoluto |

A estrutura final do `dashboardContent` sera:

```text
<div className="relative">
  <div className="space-y-6">
    {/* secoes nativas: pipeline, funnel_time, conversion, etc */}
  </div>
  {/* InsightsGrid em fluxo normal - sem overlay */}
  {hasCustomVisuals && onLayoutChange && (
    <InsightsGrid visuals={visuals} onLayoutChange={onLayoutChange} />
  )}
</div>
```

Isso garante que os visuais customizados se comportem exatamente como nos dashboards regulares: posicao fixa, sem deslocamento ao filtrar ou ao usar modo foco/tela cheia.

