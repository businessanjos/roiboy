# Segunda empresa (CNPJ) dentro do mesmo ROY

Manter um único ambiente Eternum (mesmos clientes, equipe, CS, RH, marketing) e introduzir a dimensão **Empresa** apenas onde o CNPJ realmente muda: vendas e financeiro. A empresa de cada venda vem do **produto**.

A base já tem uma tabela `companies` (razão social, CNPJ, endereço, regime tributário, token fiscal) e um seletor de empresa parcialmente usado no financeiro — hoje sem nenhuma empresa cadastrada. O caminho é ativar e completar essa estrutura, e não criar uma segunda conta.

## O que muda para o usuário

1. **Cadastro de empresas** (Configurações > Empresas): CRUD com razão social, CNPJ, endereço, dados fiscais e marcação de empresa padrão. Cadastramos a Eternum como padrão e a nova empresa em seguida.
2. **Produto define a empresa**: cada produto passa a ter o campo "Empresa emissora". Produtos existentes ficam na Eternum automaticamente.
3. **Vendas**: ao ganhar um negócio, o contrato e a proposta já sabem o CNPJ (vindo do produto). Badge da empresa no card do negócio, no contrato e no wizard de proposta. Filtro por empresa no pipeline e nos dashboards comerciais.
4. **Financeiro**: seletor global de empresa no topo (Eternum / Nova / Todas). Parcelas, lançamentos, faturas, DRE, cobrança e conciliação respeitam o seletor; "Todas" mostra o consolidado.
5. **Fiscal**: cada empresa tem seus próprios dados de emissão de NFS-e, então a nota sai no CNPJ certo conforme o produto vendido.
6. **Visibilidade**: todos continuam vendo tudo, com filtro. Sem mudança de permissões.

## O que não muda

Clientes, CS, contratos de atendimento, RH, marketing, eventos e RoyZapp continuam compartilhados e sem seletor de empresa.

## Detalhes técnicos

Migração:
- Seed de `public.companies`: Eternum (`is_default = true`) a partir dos dados de `accounts`, mais a nova empresa.
- Novas colunas `company_id` (FK `companies`, nullable) em `products`, `deals`, `client_contracts`, `contratadas`. Backfill de tudo para a empresa padrão.
- Trigger em `deals`/`client_contracts` para preencher `company_id` a partir do `product_id` quando vier vazio.
- `financial_entries`, `invoices` e `payers` já têm `company_id`: backfill para a empresa padrão e propagação a partir do contrato em `generate_contract_receivables` / `generate_contract_installments`.
- Índices por (`account_id`, `company_id`) nas tabelas financeiras.
- Sem mudança de RLS (escopo continua `account_id`).

Frontend:
- Estender `CompanyContext` com a opção "Todas" (`currentCompanyId = null` já representa isso) e expor um `<CompanySelector>` no header do financeiro.
- Aplicar o filtro `company_id` nas queries das páginas em `src/pages/financial/*` (hoje só `FinancialInstallmentsPage` filtra).
- Campo "Empresa emissora" no formulário de produto; badge de empresa em pipeline, contrato e proposta.
- Página `Configurações > Empresas` para CRUD.
- Área fiscal: `contratadas` passa a ser resolvida pela empresa do contrato em vez do único registro padrão; ajustar `ensure_default_contratada` e a edge `nfse-issue`.

## Ordem de execução

1. Migração + seed das duas empresas e backfills.
2. CRUD de empresas e campo no produto.
3. Propagação nas vendas (deal > contrato > financeiro).
4. Seletor global e filtros no financeiro.
5. Fiscal por empresa (NFS-e).
