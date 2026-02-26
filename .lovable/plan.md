

## Remover Funil de Vendas e deixar espaco livre

### Objetivo

Remover o componente `SalesFunnelChart` da secao "Funil e Tempo" no painel WhatsApp, mantendo o espaco de 3 colunas (60%) vazio e disponivel para o usuario inserir um visual customizado manualmente.

### Alteracao

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

Na secao "Funil e Tempo" (linhas 156-172), substituir o `SalesFunnelChart` por um placeholder vazio que mantem o mesmo espaco visual:

```text
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-3">
    <!-- Remover SalesFunnelChart -->
    <!-- Manter div vazia com altura minima e borda tracejada -->
    <div className="h-full min-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/20 
         flex items-center justify-center text-muted-foreground text-sm">
      Espaco disponivel para visual customizado
    </div>
  </div>
  <div className="lg:col-span-2">
    <TimePerStageCard ... />  <!-- Mantido -->
  </div>
</div>
```

### Resultado

- O espaco de 60% onde ficava o funil fica vazio com uma indicacao visual discreta (borda tracejada)
- O `TimePerStageCard` continua no lado direito sem alteracoes
- O usuario pode usar o botao "Adicionar Visual" para preencher o espaco com um visual customizado

| Arquivo | Alteracao |
|---|---|
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | Substituir SalesFunnelChart por placeholder vazio |

