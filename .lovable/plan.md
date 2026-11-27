# Recorrência no ranking da Anjos

## Regra solicitada
- Considerar **os valores efetivamente recebidos no mês selecionado referentes a vendas recorrentes de meses anteriores**.
- **Excluir todas as vendas novas do próprio mês**, mesmo que tenham pagamentos confirmados: elas já entram no valor de vendas.
- Exibir esse resultado por vendedor e no total discreto abaixo do total da Anjos, mantendo as vendas novas separadas.

## Ajustes
1. Trocar o cálculo atual de MRR da carteira por recebimentos confirmados no mês. Não incluir cobranças pendentes, projeções ou dividir pagamentos anuais por 12.
2. Usar a data de ganho do negócio para distinguir vendas anteriores das novas e a data de pagamento para enquadrar o recebimento no mês escolhido. Sem data confiável, não presumir que a venda é antiga.
3. Contabilizar cada pagamento uma única vez, atribuído ao vendedor correspondente; considerar recebimentos válidos de vendas anteriores mesmo que o contrato não esteja mais ativo.
4. Ajustar a identificação para **“Recorrência recebida”**, sem o sufixo de MRR “/mês”, preservando o tamanho discreto, as cores e a privacidade dos valores.
5. Manter o valor principal, as metas e as demais empresas inalterados.

## Validação
- Venda de outubro com pagamento em novembro: entra na recorrência de novembro.
- Venda de novembro com pagamento em novembro: não entra na recorrência de novembro.
- Venda antiga com dois recebimentos confirmados em novembro: ambos entram, sem duplicidade.
- Pagamento pendente ou recebido fora de novembro: não entra.
- Conferir que a soma por vendedor corresponde ao total da Anjos e que trocar o mês atualiza os resultados.

## Detalhes técnicos
O cálculo atual em `rankingRecurringValue` soma o MRR de contratos em vigor. O snapshot já lido pelo ranking contém `wonAt`, vendedor e parcelas com valor, situação e data de pagamento. O ajuste ficará no cálculo e na apresentação do ranking, reutilizando essa leitura com as permissões existentes, sem alterar dados reais, integrações, contratos ou regras de ganho. Incluir testes do novo cálculo e conferir o ranking na tela; não publicar sem autorização.