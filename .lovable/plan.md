
## Adicionar Filtro de Etapas no Funil de Vendas

### Objetivo
Inserir um botao sutil no header do card "Funil de Vendas" que, ao ser clicado, expande um popover com checkboxes para marcar/desmarcar quais etapas aparecem no funil.

### Mudancas

**Arquivo: `src/components/insights/whatsapp-dashboard/SalesFunnelChart.tsx`**

- Adicionar um state local `hiddenStages` (Set de nomes de etapas ocultas), inicialmente vazio (todas visiveis)
- Adicionar um botao de icone discreto (icone `Settings2` ou `SlidersHorizontal` do lucide-react) ao lado do titulo "Funil de Vendas"
- Ao clicar no botao, abrir um `Popover` (do Radix/shadcn) contendo a lista de todas as etapas do pipeline + "Venda"
- Cada etapa sera um item com `Checkbox` e o nome da etapa, com a cor da etapa como indicador visual (bolinha colorida)
- Ao marcar/desmarcar, o state `hiddenStages` e atualizado e o funil re-renderiza mostrando apenas as etapas selecionadas
- A logica de calculo cumulativo sera aplicada somente sobre as etapas visiveis, garantindo que o funil se recalcule corretamente

### Detalhes de UI
- O botao ficara posicionado no `CardHeader`, ao lado direito do titulo
- Estilo ghost + tamanho pequeno para ser sutil e nao competir visualmente com o funil
- O popover tera fundo solido (`bg-popover`), z-index alto, e largura fixa (~220px)
- Cada checkbox tera uma bolinha colorida com a cor da etapa para facilitar a identificacao

### Comportamento
- Por padrao, todas as etapas vem marcadas (visiveis)
- Desmarcar uma etapa a remove do funil e recalcula as larguras e conversoes
- Deve haver pelo menos 1 etapa visivel (desabilitar desmarcacao se restar apenas 1)
