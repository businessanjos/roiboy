
## Redirecionar link do nome do Lead para a pagina de Leads

### Problema

No detalhe do negocio (DealDetailSheet), ao clicar no nome do contato (ex: "Magda Paula Morais Cardoso"), o sistema redireciona para `/clients/{client_id}` (pagina do cliente). O usuario deseja que o link aponte para `/leads?lead={lead_id}` (pagina do lead vinculado ao negocio).

### Mudanca

**Arquivo:** `src/components/sales/DealDetailSheet.tsx` (linhas 707-728)

Inverter a prioridade da logica de navegacao:

- **Antes:** `client_id` tem prioridade sobre `lead_id` — se existe cliente, vai para `/clients/{id}`
- **Depois:** `lead_id` tem prioridade sobre `client_id` — se existe lead vinculado, vai para `/leads?lead={id}`

Logica atualizada:

1. Se `deal.lead_id` existe: navegar para `/leads?lead={lead_id}`
2. Senao, se `deal.client_id` existe: navegar para `/clients/{client_id}`
3. Senao: exibir texto sem link

### Secao tecnica

Apenas uma mudanca no arquivo `DealDetailSheet.tsx`: inverter a ordem dos blocos condicionais nas linhas 707-728, colocando `deal.lead_id` como primeira condicao e `deal.client_id` como fallback.
