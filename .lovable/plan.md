

## Exportar Clientes (CSV / XLSX)

Adicionar um botao "Exportar" ao lado do botao "Importar CSV" na pagina de Clientes, permitindo ao usuario baixar os clientes filtrados em formato CSV ou XLSX.

### O que sera feito

1. **Botao "Exportar"** ao lado do "Importar CSV" com um dropdown (DropdownMenu) oferecendo duas opcoes:
   - Exportar como CSV
   - Exportar como Excel (XLSX)

2. **Dados exportados** -- os clientes ja filtrados pelo servidor (estado `clients`), incluindo as colunas:
   - Nome, Telefone, Email, CPF, CNPJ, Empresa, Status do cliente
   - Produto(s), Status do contrato, Data inicio/fim contrato
   - V-NPS, E-Score, Roizometro
   - Responsavel, Tags, Observacoes

3. **Filtros aplicados** -- como a lista ja vem filtrada do servidor, o export reflete exatamente o que o usuario ve na tela.

---

### Detalhes tecnicos

**Arquivo modificado:** `src/pages/Clients.tsx`

- Importar `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` de `@/components/ui/dropdown-menu`
- Criar funcao `exportClients(format: 'csv' | 'xlsx')` que:
  - Mapeia o array `clients` para linhas com colunas legíveis em portugues
  - Enriquece com dados de `vnpsMap`, `scoreMap`, `contractMap`, `teamUsers`
  - Para CSV: gera string com separador `;` (compativel com Excel BR), cria Blob e dispara download
  - Para XLSX: gera o arquivo usando a lib `xlsx` (SheetJS) -- sera necessario instalar o pacote `xlsx`
- Adicionar o botao com icone `Download` ao lado do "Importar CSV"

**Dependencia nova:** pacote `xlsx` para geracao de arquivos Excel.

