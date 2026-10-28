# Planilha dos contratos "Não informado" em Motivos de Perda

Objetivo: entregar uma planilha Excel com todos os contratos que hoje aparecem como "Não informado" no gráfico de Motivos de Perda (aba Resultados de Renovações, Este ano). Assim você decide para onde vai cada um. Nada no sistema e nenhum dado de cliente será alterado.

## O que a planilha terá

**Aba 1 – Não informados (uma linha por contrato)**
- Cliente, telefone, e-mail, produto, consultora/responsável
- Status do contrato (em português), início, término, data do cancelamento/status, valor
- Status da renovação e data do desfecho
- **Todos os lugares onde pode existir motivo escrito**, cada um na sua coluna:
  - motivo do registro de renovação e observações dele
  - motivo do cancelamento, justificativa do cancelamento e motivo do status, no contrato
  - observações do contrato
  - último acompanhamento/checkpoint do cliente sobre cancelamento ou renovação (com data)
- Coluna **"Onde o motivo foi encontrado"**: indica qual campo tem texto ou mostra "Nenhum"
- Coluna **"Motivo encontrado (texto original)"**: o trecho exato, sem reclassificar
- Colunas vazias **"Destino escolhido"** e **"Observação"**, com uma lista suspensa dos motivos fixos já existentes, para você preencher

**Aba 2 – Resumo**: quantidade de contratos por "onde o motivo foi encontrado" e por produto, calculada com fórmulas.

**Aba 3 – Motivos fixos**: a lista oficial atual, usada pela lista suspensa.

## Ponto sobre "puxando do lugar certo"
Antes de gerar a planilha, vou conferir campo por campo onde a ficha do cliente mostra o motivo na tela, para que a coluna pegue o mesmo campo que a ficha usa (e não só os dois campos que o gráfico lê hoje). Se o motivo estiver em um campo que o gráfico não consulta, isso fica destacado na planilha. Corrigir o gráfico fica para depois da sua análise.

## Detalhes técnicos
- Só leitura no banco: `client_contracts`, `renewal_outcomes`, `clients`, `products`, `users`, `client_followups`, com a mesma regra de perda/ano que o `RenewalLosses.tsx` usa para cair em "Não informado".
- Gerar com openpyxl em /tmp, recalcular e verificar se há erros de fórmula e depois salvar em `/mnt/documents/nao_informados_motivos_perda.xlsx`.
- Nenhuma alteração de código, banco, permissões ou publicação.
