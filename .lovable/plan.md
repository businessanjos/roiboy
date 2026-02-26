

## Adicionar botao "Adicionar Visual" e opcao de ocultar secoes no painel Conversas/WhatsApp

### Objetivo

Tornar o painel Conversas/WhatsApp tao flexivel quanto os demais paineis, permitindo adicionar visuais customizados e ocultar secoes built-in que nao sejam relevantes.

### Alteracoes

**1. InsightsMainContent.tsx -- Permitir coexistencia de WhatsApp panel + visuais customizados**

- Remover a condicao `!hasVisuals` da linha 165 que faz o WhatsApp panel desaparecer quando visuais customizados existem.
- Sempre renderizar o `WhatsAppDashboardPanel` para dashboards de Conversas/WhatsApp.
- Passar props para o WhatsApp panel: `onAddVisual`, `visuals`, `onLayoutChange`, `isLoadingVisuals`.
- Manter o `AddVisualModal` montado para o WhatsApp panel poder abri-lo.

**2. WhatsAppDashboardPanel.tsx -- Adicionar botao e sistema de ocultar secoes**

- Receber novas props: `onAddVisual`, `visuals`, `onLayoutChange`, `isLoadingVisuals`.
- Adicionar botao "Adicionar Visual" no header, ao lado do "Modo Foco".
- Criar estado `hiddenSections` (Set de strings) para controlar quais secoes estao ocultas.
- Adicionar icone de "olho" (EyeOff) em cada `CollapsibleSection` via prop `rightContent`, permitindo ocultar a secao.
- Secoes ocultas nao serao renderizadas no dashboard.
- Adicionar botao "Restaurar secoes" que aparece quando alguma secao esta oculta.
- Renderizar `InsightsGrid` com visuais customizados apos as secoes built-in.
- Incluir visuais customizados tambem no Modo Foco.

### Secoes com opcao de ocultar

| ID | Secao |
|---|---|
| `pipeline` | Pipeline de Conversao |
| `funnel_time` | Funil e Tempo |
| `conversion` | Taxas de Conversao |
| `leads` | Leads por Dia |
| `engagement` | Analise de Engajamento |
| `time_saved` | Tempo Economizado |

### Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/insights/InsightsMainContent.tsx` | Remover condicao exclusiva, passar props ao WhatsApp panel, montar AddVisualModal |
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | Adicionar botao "Adicionar Visual", sistema de ocultar secoes, renderizar InsightsGrid |

