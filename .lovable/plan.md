

## Análise: O campo `nCodCC` é obrigatório na API do Omie?

**Sim, é obrigatório.** A documentação oficial do Omie ("Cadastrando uma Ordem de Serviço via API") lista o `nCodCC` como campo necessário no bloco `InformacoesAdicionais`, junto com `cCodCateg`. Todos os exemplos oficiais incluem esse campo.

Se enviarmos a OS sem `nCodCC`, a API do Omie retornará erro.

### Opções

1. **Manter como está** — o campo continua obrigatório na configuração, e o usuário precisa preencher uma vez com o código da conta corrente padrão do Omie.

2. **Tornar opcional com fallback** — remover a validação obrigatória e, se não preenchido, omitir o campo do payload. Isso provavelmente causará erro na API do Omie, mas podemos capturá-lo e exibir uma mensagem clara.

3. **Buscar automaticamente** — usar a API `ListarContasCorrentes` do Omie para buscar as contas correntes disponíveis e permitir que o usuário selecione de uma lista (em vez de digitar o código manualmente). Isso melhora a UX e elimina erro de digitação.

### Recomendação

A **opção 3** é a melhor: criar um seletor que busca as contas correntes do Omie via API e permite escolher. Assim o campo continua sendo preenchido (pois é obrigatório), mas de forma muito mais fácil.

### Implementação (Opção 3)

1. **Criar Edge Function `list-omie-accounts`** — chama `ListarContasCorrentes` na API do Omie e retorna as opções disponíveis (código + descrição).
2. **Substituir o campo de texto** no `OmieIntegrationTab` por um `Select` que carrega as contas correntes ao clicar em "Carregar contas" (usando as credenciais já salvas).
3. **Manter o campo obrigatório** na validação, pois a API do Omie exige.

