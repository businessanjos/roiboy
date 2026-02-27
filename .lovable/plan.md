

## Fixar visuais customizados no espaço reservado da seção "Funil e Tempo"

### Problema

Atualmente o `InsightsGrid` com os visuais customizados (como o Funil de Vendas) e renderizado apos todas as secoes nativas, aparecendo no final do dashboard. O usuario quer que ele fique dentro do espaco reservado (placeholder com borda tracejada) na secao "Funil e Tempo".

### Solucao

Mover a renderizacao do `InsightsGrid` de depois de todas as secoes para dentro do placeholder da secao "Funil e Tempo" (o `div` com `min-h-[500px]` e borda tracejada).

### Alteracao

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

1. **Linhas 159-162**: Substituir o placeholder estatico pela renderizacao condicional:
   - Se houver visuais customizados, renderizar o `InsightsGrid` nesse espaco
   - Se nao houver, manter o placeholder com texto "Espaco disponivel para visual customizado"

2. **Linhas 230-233**: Remover o bloco do `InsightsGrid` que esta no final do dashboard (apos todas as secoes)

### Estrutura resultante

```text
<CollapsibleSection title="Funil e Tempo">
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
    <div className="lg:col-span-3">
      {hasCustomVisuals ? (
        <div className="h-full min-h-[500px]">
          <InsightsGrid visuals={visuals} onLayoutChange={onLayoutChange} />
        </div>
      ) : (
        <div className="placeholder...">
          Espaco disponivel para visual customizado
        </div>
      )}
    </div>
    <div className="lg:col-span-2">
      <TimePerStageCard ... />
    </div>
  </div>
</CollapsibleSection>
```

Isso garante que o funil customizado fique sempre fixo ao lado do "Tempo por Etapa", independente de filtros, modo foco ou tela cheia.

