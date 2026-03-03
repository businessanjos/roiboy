

## Correção: Código LC116 vs Código Municipal do Serviço

### Problema
O erro **"Código da LC116 não cadastrada para o Código [8599604]"** indica que o valor `8599604` configurado como "Código do Serviço" é um código **CNAE** ou **municipal**, mas **não** é um código válido da **Lei Complementar 116** (LC116).

A API do Omie exige dois códigos distintos no bloco `ServicosPrestados`:
- `cCodServLC116` — código padronizado nacional (formato: `XX.XX`, ex: `14.01`, `17.01`)
- `cCodServMun` — código municipal do serviço (pode ser numérico como `8599604`)

Atualmente, ambos os campos usam o mesmo valor (`default_service_code`), o que causa o erro quando o código municipal não é um código LC116 válido.

### Correção

1. **Banco de dados** — Adicionar coluna `default_service_lc116_code` na tabela `omie_settings` para armazenar o código LC116 separadamente.

2. **Edge Function `create-omie-os`** — Usar `default_service_lc116_code` para `cCodServLC116` e `default_service_code` para `cCodServMun`.

3. **UI `OmieIntegrationTab`** — Adicionar campo separado para o "Código do Serviço LC116" com placeholder indicando o formato esperado (ex: `14.01`), mantendo o campo existente como "Código Municipal do Serviço".

### Resultado
O usuário poderá configurar ambos os códigos independentemente, resolvendo a incompatibilidade de formato.

