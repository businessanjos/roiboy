# Detalhar o valor Captado nos SPIFFs

Hoje, na área de SPIFFs, o valor "Captado" de cada vendedor aparece apenas como um número somado. Não dá para saber de quais negociações ele veio.

## O que muda

O valor "Captado" passa a ser clicável. Ao clicar, abre uma janela com a lista das negociações que formaram aquele valor, mostrando para cada uma:

- Nome da negociação e do contato/cliente
- Valor recebido (o mesmo campo "Valor recebido" da ficha da negociação)
- Valor total da negociação
- Data do ganho
- Produto (item da venda), quando houver

No rodapé da janela: total somado, quantidade de negociações e quantos giros esse total gerou.

A lista tem rolagem própria com o cabeçalho fixo, para funcionar bem mesmo com muitas negociações e em telas pequenas. Cada linha é clicável e abre a ficha da negociação; a janela também tem botão de fechar funcional.

## Detalhes técnicos

- Arquivo: `src/components/sales/quotas/SpiffsSection.tsx` (`RouletteSpinsPanel`).
- A consulta atual de `deals` passa a trazer também `title`, `contact_name`, `client_id` e `currency`, mantendo os mesmos filtros (conta, `status='won'`, período do SPIFF e produto-alvo via `deal_field_values`).
- O agrupamento por vendedor guarda a lista de negócios além do total, para alimentar o detalhamento sem nova consulta.
- Novo componente de diálogo (`CapturedDealsDialog`) dentro do mesmo arquivo, usando `Dialog` + `Table` do shadcn e `formatBRL` já existente.
- O valor por negociação segue a mesma regra do cálculo atual: `received_value ?? entry_value ?? 0`, para o detalhe sempre bater com o total exibido.
- Somente leitura: nenhuma alteração de banco, RLS ou regra de cálculo dos giros.
