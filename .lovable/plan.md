
## Colocar "De" e "Até" lado a lado

Agrupar os dois campos de data em um wrapper com `col-span-2 grid grid-cols-2 gap-4`, fazendo com que ocupem a largura de duas colunas do grid pai mas fiquem lado a lado internamente.

**Arquivo:** `src/components/sales/PipelineExportDialog.tsx` (linhas 630-648)

Substituir os dois `<div>` separados por um único `<div className="col-span-2 grid grid-cols-2 gap-4">` contendo ambos os campos.
