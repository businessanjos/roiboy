

## Corrigir posicionamento do grid de visuais customizados no painel WhatsApp

### Problema

O `InsightsGrid` (grid de visuais customizados) e renderizado **apos** todas as secoes built-in do dashboard, como um bloco separado no final da pagina. Isso faz com que os visuais so possam existir abaixo de todo o conteudo fixo -- nao e possivel arrasta-los para o espaco vazio na secao "Funil e Tempo".

### Solucao

Transformar o layout do dashboard em um container `relative` e renderizar o `InsightsGrid` como uma camada sobreposta (`relative` com `z-index`) **acima** das secoes built-in. Assim os visuais customizados podem ser posicionados livremente em qualquer area do dashboard, incluindo sobre o placeholder vazio.

### Alteracoes

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

1. Envolver o `dashboardContent` em um `div` com `position: relative`
2. Mover o `InsightsGrid` para DENTRO desse container, renderizado ANTES das secoes built-in
3. As secoes built-in continuam fluindo normalmente como conteudo estatico
4. O `InsightsGrid` usa `position: relative` com `z-index` superior, permitindo que visuais fiquem sobre qualquer area do dashboard

```text
// Estrutura proposta:
<div className="relative">
  {/* Grid de visuais customizados - camada superior, posicionamento livre */}
  {hasCustomVisuals && onLayoutChange && (
    <div className="relative z-10">
      <InsightsGrid visuals={visuals} onLayoutChange={onLayoutChange} />
    </div>
  )}

  {/* Secoes built-in - fluxo normal */}
  <div className="space-y-6">
    {sectionVisible('pipeline') && ... }
    {sectionVisible('funnel_time') && ... }
    ...
  </div>
</div>
```

5. Aplicar a mesma estrutura no conteudo do Modo Foco para manter consistencia

### Resultado

- Visuais customizados podem ser posicionados livremente sobre qualquer area do dashboard
- O usuario pode arrastar um visual para cima do espaco vazio na secao "Funil e Tempo"
- As secoes built-in continuam funcionando normalmente por baixo
- O Modo Foco tambem reflete essa estrutura

| Arquivo | Alteracao |
|---|---|
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | Mover InsightsGrid para o topo do container com z-index, envolver conteudo em container relativo |

