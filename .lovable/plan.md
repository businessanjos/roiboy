# Lista de clientes que não renovaram

## O que existe hoje
Na Operação > Renovações você vê a lista com o status de cada cliente (Renovado, Cancelou), mas não tem um botão para baixar. Hoje há 331 clientes marcados como "não renovou/cancelou", 31 renovados e 7 em negociação.

## O que vou entregar agora
Uma planilha Excel pronta para baixar, só com quem não renovou, com as mesmas colunas da tela:
- Cliente
- Consultora
- Produto
- Valor Renovação
- Venceu em
- Data renovação (data em que o status foi marcado)
- Status
- Motivo (e a observação, quando houver)

Ordenada pela data de vencimento, da mais recente para a mais antiga. Só leitura: nada no ROY é alterado.

## Opcional (só se você quiser depois)
Um botão "Exportar" na própria tela de Renovações, respeitando os filtros, para gerar a lista quando precisar.

## Detalhes técnicos
Consulta somente leitura em `renewal_outcomes` (outcome = lost) junto com `client_contracts`, `clients`, `products` e `users` (responsável), gerando o XLSX em /mnt/documents.
