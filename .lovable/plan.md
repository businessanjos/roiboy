

## Correção definitiva: campos obrigatórios da API Omie IncluirOS

### Diagnóstico
Consultei a **documentação oficial do Omie** para o método `IncluirOS`. O campo `cRetemISS` (retenção de ISS: "S" ou "N") é obrigatório no bloco `ServicosPrestados`, e nosso payload não o inclui.

Além disso, o campo `cCidPrestServ` (cidade de prestação do serviço, ex: "SAO PAULO (SP)") aparece em todos os exemplos oficiais no bloco `InformacoesAdicionais`. Vou adicioná-lo também para prevenir futuros erros.

### Campos obrigatórios do `ServicosPrestados` (documentação oficial):
| Campo | Status | Nosso payload |
|-------|--------|--------------|
| `cCodServLC116` | OK | Já incluído |
| `cCodServMun` | OK | Já incluído |
| `cDescServ` | OK | Já incluído |
| `cTribServ` | OK | Já incluído |
| **`cRetemISS`** | **FALTANDO** | Adicionar |
| `nQtde` | OK | Já incluído |
| `nValUnit` | OK | Já incluído |

### Correção

1. **Edge Function `create-omie-os`** — Adicionar `cRetemISS: "N"` (padrão: não retém ISS) usando valor configurável das settings. Adicionar também `cCidPrestServ` nas `InformacoesAdicionais`.

2. **Banco de dados** — Adicionar colunas `default_retem_iss` (text, default "N") e `default_city` (text) na tabela `omie_settings`.

3. **UI `OmieIntegrationTab`** — Adicionar:
   - Seletor de Retenção de ISS (Sim/Não)
   - Campo de Cidade de Prestação do Serviço (ex: "SAO PAULO (SP)")

Isso cobre **todos os campos obrigatórios** da documentação oficial, evitando novos erros por campos faltantes.

