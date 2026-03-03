

## Correção: Campo `cTribServ` obrigatório na API do Omie

### Problema
A API do Omie exige o campo `cTribServ` (Tipo de Tributação do Serviço) no bloco `ServicosPrestados`. Atualmente ele está hardcoded como string vazia `''`, causando o erro: *"É obrigatório o Tipo de Tributação de serviço, tag [cTribServ], na inclusão!"*

### Solução
De acordo com a documentação oficial do Omie, o valor mais comum para `cTribServ` é `"01"` (tributação no município). Os valores possíveis são códigos como `01`, `02`, `03`, etc.

A melhor abordagem é adicionar um campo de configuração na tela de integração para que o usuário escolha o tipo de tributação, com valor padrão `"01"`.

### Implementação

1. **Migração do banco** — Adicionar coluna `default_tax_type` na tabela `omie_settings` com valor padrão `'01'`.

2. **Edge Function `create-omie-os`** — Usar `settings.default_tax_type || '01'` em vez de `''` no campo `cTribServ` do payload.

3. **UI `OmieIntegrationTab`** — Adicionar um campo `Select` com as opções de tributação mais comuns:
   - `01` — Tributação no Município
   - `02` — Tributação Fora do Município  
   - `03` — Isenção
   - `04` — Imune
   - `05` — Exigibilidade Suspensa por Decisão Judicial
   - `06` — Exigibilidade Suspensa por Procedimento Administrativo

   Salvar o valor selecionado na coluna `default_tax_type`.

