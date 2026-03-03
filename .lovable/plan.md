

## Adicionar filtro de período na exportação de negócios

### O que será feito
Adicionar dois campos de data ("De" e "Até") na seção de Filtros do `PipelineExportDialog`, permitindo filtrar os negócios exportados por período. O filtro será aplicado sobre a data de criação do negócio (`created_at`), e quando o status for "Ganhas" ou "Perdidas", também considerar `won_at`/`lost_at`.

### Alterações

**Arquivo: `src/components/sales/PipelineExportDialog.tsx`**

1. **Novos estados** — Adicionar `filterDateFrom` e `filterDateTo` (strings no formato `YYYY-MM-DD`, inicialmente vazios).

2. **UI** — Inserir uma nova linha no grid de filtros com dois `<input type="date">` lado a lado, com labels "De" e "Até", posicionados logo após o filtro de Status/Responsável (ou como última linha de filtros).

3. **Lógica de filtro** — No `handleExport`, após os filtros existentes, adicionar:
   - Se `filterDateFrom` estiver preenchido, filtrar `deals` com `created_at >= filterDateFrom`.
   - Se `filterDateTo` estiver preenchido, filtrar `deals` com `created_at <= filterDateTo + 23:59:59`.
   - Isso garante que o intervalo é inclusivo em ambos os extremos.

### Resultado
O usuário poderá definir um intervalo de datas na janela de exportação, limitando os negócios exportados ao período desejado.

