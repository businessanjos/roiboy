

## Remover campo `cVendedor` do payload da OS

### Problema
A API do Omie para Ordens de Serviço (`IncluirOS`) **não aceita** a tag `cVendedor` no objeto `Cabecalho`. Esse campo existe apenas na API de Pedidos de Venda. A documentação oficial confirma que os campos válidos do `Cabecalho` são: `cCodIntOS`, `cCodParc`, `cEtapa`, `dDtPrevisao`, `nCodCli`, `nQtdeParc`.

### Solução
Remover a linha `cVendedor: vendedor` do objeto `Cabecalho` no payload. O nome do vendedor já é incluído no campo `Observacoes.cObsOS`, que é o local correto para essa informação em OS.

### Alteração
**`supabase/functions/create-omie-os/index.ts` (linha 211)**
- Remover: `cVendedor: vendedor,`

Apenas 1 linha removida. O restante do payload permanece inalterado.

