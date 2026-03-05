

## Plano: Auto-cadastro de cliente no Omie quando não encontrado

### Contexto

Atualmente, quando o `create-omie-os` não encontra o cliente no Omie por CPF/CNPJ nem por nome, ele lança um erro e para. A proposta é: em vez de falhar, **criar automaticamente o cliente no Omie** usando os dados disponíveis do negócio/cliente do sistema, e então **prosseguir com a criação da OS** na mesma execução.

### Alterações

**Arquivo: `supabase/functions/create-omie-os/index.ts`**

1. **Nova função `createOmieClient`** — chama a API `geral/clientes` com o call `IncluirCliente`, montando o payload com:
   - `cnpj_cpf`: CPF ou CNPJ limpo (sem formatação)
   - `razao_social`: nome completo do cliente (ou título do negócio como fallback)
   - `nome_fantasia`: mesmo valor
   - `email`: primeiro email do cliente (se disponível)
   - `telefone1_numero`: telefone do cliente (se disponível)
   - `endereco` / `cidade` / `estado` / `cep`: dados do cliente se disponíveis
   - `contribuinte`: `2` (não contribuinte, padrão para serviços)
   - `pessoa_fisica`: `S` ou `N` baseado no tamanho do documento (CPF=11 → S, CNPJ=14 → N)

2. **Substituir o `throw` na linha 193-195** — quando `omieClient` é `null` e há um CPF/CNPJ disponível:
   - Chamar `createOmieClient` com os dados coletados
   - Atribuir o resultado a `omieClient`
   - Logar no console que o cliente foi criado automaticamente
   - Se não houver CPF/CNPJ, manter o erro atual (não é possível cadastrar sem documento)

3. **Log de criação** — registrar no `omie_integration_logs` com action `auto_create_client` antes de prosseguir com a OS, para rastreabilidade

### Fluxo resultante

```text
Negócio ganho → create-omie-os
  ├─ Busca cliente por CPF/CNPJ no Omie
  ├─ Busca cliente por nome no Omie (fallback)
  ├─ Se encontrou → segue criando OS (comportamento atual)
  └─ Se NÃO encontrou:
       ├─ Tem CPF/CNPJ? → Cria cliente no Omie → Segue criando OS
       └─ Sem CPF/CNPJ? → Erro (não é possível cadastrar sem documento)
```

### Detalhes técnicos

O payload mínimo para `IncluirCliente` na API Omie exige:
- `cnpj_cpf` (obrigatório)
- `razao_social` (obrigatório)
- `codigo_cliente_integracao` (identificador único — usaremos o `client.id` ou `deal_id`)

A resposta retorna `codigo_cliente_omie` que será usado como `nCodCli` na OS.

Nenhuma alteração de banco de dados necessária — o campo `action` no `omie_integration_logs` já é `text` e aceita o novo valor `auto_create_client`.

