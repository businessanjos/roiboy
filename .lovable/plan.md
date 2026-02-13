
## Corrigir duplicacao dos campos MQL, Canal e Faturamento

### Problema
Os campos MQL, Canal e Faturamento estao aparecendo duas vezes no detalhe do Lead:
1. Uma vez como badges fixos hardcoded (linhas 355-369)
2. Uma segunda vez via sistema de campos personalizados (custom fields, linhas 382-400)

### Solucao
Remover o bloco hardcoded de badges (linhas 355-369) do arquivo `src/components/leads/LeadDetailSheet.tsx`. Os campos personalizados ja cuidam de exibir MQL, Canal e Faturamento Atual com a vantagem de serem editaveis inline.

### Arquivo alterado
- `src/components/leads/LeadDetailSheet.tsx`: remover as linhas 355-369 (bloco com comentario "MQL, Canal, Faturamento badges")
