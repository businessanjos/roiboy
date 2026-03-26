## Plano Anterior: Filtro por Status do Negócio (concluído)

---

## Plano do Módulo Financeiro - Contas a Receber

### Análise dos Documentos (Esqueleto + Complemento)

### Fase 1 — Wizard de Criação de Venda
- Fluxo em etapas: Cliente → Produto → Condições de Pagamento → Parcelas → Confirmação
- Geração automática de parcelas (financial_entries) a partir do contrato (client_contracts)
- Suporte a múltiplas formas de pagamento: boleto, cartão, PIX, cheque, dinheiro
- Cálculo automático de datas de vencimento baseado na data da primeira parcela

### Fase 2 — Layout Pós-Geração (Gestão do Título)
- Visualização e gestão individual de cada parcela/título
- Status de cobrança: pendente, pago, atrasado, cancelado, renegociado
- Campos adicionais por forma de pagamento:
  - Cheque: nº do cheque, banco, agência, conta, data de compensação
  - Cartão: NSU, bandeira, últimos 4 dígitos
  - Boleto: linha digitável, código de barras
  - PIX: chave, ID da transação
- Registro de tratativas/observações por título
- Baixa manual e automática de pagamentos

### Fase 3 — Regras de Negócio Avançadas
- Bloqueio de edição após confirmação
- Validações rigorosas (valores, datas, dados obrigatórios)
- Auditoria de alterações
- Renegociação de parcelas com histórico

### Entidades Existentes Mapeadas
- `client_contracts` — contratos de clientes
- `financial_entries` — lançamentos financeiros / parcelas
- `bank_accounts` — contas bancárias
- `clients` — clientes
- `products` — produtos
- `boletos` — boletos

### Status
- [ ] Fase 1 — Wizard de Venda
- [ ] Fase 2 — Gestão de Títulos
- [ ] Fase 3 — Regras Avançadas
