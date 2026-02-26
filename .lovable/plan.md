
## Exportar Negocios do Pipeline com Filtros e Selecao de Campos

### Resumo

Criar um botao "Exportar" na aba Pipeline que abre um dialog com filtros e selecao de colunas, permitindo exportar negocios nos formatos CSV ou XLSX.

### Novo componente: `src/components/sales/PipelineExportDialog.tsx`

Dialog com 3 secoes:

**Secao 1 - Formato de exportacao**
- Radio group: CSV ou XLSX (Excel)

**Secao 2 - Filtros (opcionais)**
- Responsavel (select com lista de vendedores do setor vendas)
- Etapa (select com stages do pipeline)
- Produto / Item da Venda (select com produtos da conta)
- MQL (select com opcoes do campo custom MQL)
- Faturamento Atual (select com opcoes do campo custom)
- Canal (select com opcoes do campo custom Canal de Venda)
- Status: Em Aberto, Ganhas, Perdidas (multi-select ou select)

**Secao 3 - Campos para exportar (checkboxes)**
Campos fixos disponiveis:
- Titulo do negocio
- Lead (nome)
- Telefone do lead
- Email do lead
- Etapa
- Responsavel
- Valor
- Status
- Data de criacao
- Data de ganho/perda
- Motivo de perda
- Probabilidade
- Tags

Campos personalizados (buscados dinamicamente via `custom_fields` com `show_in_deals = true`):
- Todos os campos ativos aparecem como checkboxes
- Por padrao todos marcados

### Logica de exportacao

1. Buscar todos os deals da conta (paginando com `.range()` em batches de 500)
2. Para cada deal, buscar `deal_field_values` em batch
3. Aplicar filtros selecionados no dialog
4. Para campos select/multi_select, resolver labels a partir das options do field
5. Gerar arquivo CSV (com BOM UTF-8, separador `;`) ou XLSX
6. Download automatico

### Alteracao em `src/pages/SalesPipeline.tsx`

- Adicionar botao "Exportar" ao lado dos botoes "Etapas" e "Campos" na header do pipeline (linha ~704)
- Importar e renderizar `PipelineExportDialog`
- Passar `stages`, `salesUsers`, e `currentUser` como props

### Estrutura tecnica do dialog

```text
+------------------------------------------+
|  Exportar Negocios                       |
|------------------------------------------|
|  Formato: ( ) CSV  ( ) XLSX             |
|------------------------------------------|
|  FILTROS                                 |
|  Status:      [Em Aberto v]             |
|  Responsavel: [Todos v]                 |
|  Etapa:       [Todas v]                 |
|  Produto:     [Todos v]                 |
|  MQL:         [Todos v]                 |
|  Fat. Atual:  [Todos v]                 |
|  Canal:       [Todos v]                 |
|------------------------------------------|
|  CAMPOS PARA EXPORTAR                    |
|  [x] Titulo  [x] Lead  [x] Telefone    |
|  [x] Etapa   [x] Responsavel  [x] Valor|
|  [x] Item da Venda  [x] MQL  [x] Canal |
|  [x] Faturamento  [x] Origem  ...      |
|  [Marcar todos] [Desmarcar todos]       |
|------------------------------------------|
|           [Cancelar]  [Exportar]         |
+------------------------------------------+
```

### Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/sales/PipelineExportDialog.tsx` | Novo - Dialog completo com filtros, selecao de campos e logica de exportacao |
| `src/pages/SalesPipeline.tsx` | Adicionar botao "Exportar" e renderizar o dialog |
