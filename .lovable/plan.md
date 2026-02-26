

## Corrigir posicionamento livre dos visuais customizados no painel WhatsApp

### Problema

O wrapper do `InsightsGrid` usa `position: relative`, o que faz ele ocupar espaco no fluxo do documento e empurrar as secoes built-in para baixo quando o visual e arrastado. O visual precisa flutuar sobre o conteudo sem afetar o layout das secoes abaixo.

### Solucao

Mudar o wrapper do `InsightsGrid` de `relative z-10` para `absolute inset-0 z-10 pointer-events-none`, tornando-o uma camada flutuante que nao interfere no fluxo das secoes built-in. Os itens do grid precisam ter `pointer-events-auto` para continuarem interativos.

### Alteracoes

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

- Alterar o wrapper do `InsightsGrid` de `relative z-10` para `absolute inset-0 z-10 pointer-events-none`
- Isso faz o grid flutuar como overlay sem empurrar o conteudo

**Arquivo:** `src/components/insights/grid/InsightsGrid.tsx`

- Adicionar `pointer-events-auto` ao container do grid para que os visuais continuem clicaveis e arrastaveis
- Garantir que o container do grid mede a largura corretamente mesmo com posicionamento absoluto (usar o pai como referencia)

### Resultado

- Visuais customizados flutuam livremente sobre qualquer area do dashboard
- Secoes built-in nao sao empurradas ou deslocadas
- Comportamento identico aos outros paineis de Insights

| Arquivo | Alteracao |
|---|---|
| `WhatsAppDashboardPanel.tsx` | Wrapper do grid: `absolute inset-0 z-10 pointer-events-none` |
| `InsightsGrid.tsx` | Container do grid: adicionar `pointer-events-auto` |

