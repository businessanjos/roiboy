# Expandir o funil em tela cheia

Adicionar um botão "Expandir" na tela de Vendas > Pipeline que faz o quadro ocupar a tela inteira, mostrando mais etapas e mais cartões por vez.

## Como vai funcionar

- Um botão com ícone de expandir aparece ao lado dos botões de visualização (quadro/lista), no topo do pipeline.
- Ao clicar, o funil abre em tela cheia: some o menu lateral, o cabeçalho e os blocos de filtros/resumo. Ficam apenas a legenda de cores, as abas Em Aberto / Ganhas / Perdidas, a busca e o quadro.
- As colunas passam a usar toda a altura disponível, então cabem mais cartões sem rolar.
- Sair da tela cheia: botão "Reduzir" no mesmo lugar ou tecla Esc.
- Arrastar cartões entre etapas, abrir a ficha do negócio e todos os filtros continuam funcionando igual.
- A escolha fica lembrada apenas durante a navegação; ao recarregar volta ao normal.
- No celular nada muda (a tela já é cheia).

## Detalhes técnicos

- `src/pages/SalesPipeline.tsx`: novo estado `isPipelineFullscreen`. Quando ativo, a seção do pipeline (legenda + sub-abas de status + conteúdo) é renderizada dentro de um contêiner `fixed inset-0 z-50 bg-background flex flex-col` com `overflow-hidden`, fora do fluxo do layout padrão; listener de `keydown` para Esc; botão de alternância com ícones `Maximize2`/`Minimize2` ao lado do seletor kanban/lista.
- `src/components/sales/DealKanban.tsx`: nova prop opcional `fullHeight?: boolean`. Quando verdadeira, o contêiner do quadro deixa de usar `calc(100vh - 220px)` e passa a `h-full min-h-0` (o pai em tela cheia define a altura via flex), preservando o comportamento atual quando a prop não é passada.
- Nenhuma mudança de dados, consultas ou permissões.
