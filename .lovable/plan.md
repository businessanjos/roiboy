
## Remover campos obrigatorios do dialog de criacao de cliente

### Problema

O dialog "Novo Cliente" exige o preenchimento de 169 campos personalizados marcados como obrigatorios antes de permitir salvar o cadastro. Esses campos sao informacoes que devem ser preenchidas posteriormente (via formulario ou manualmente no perfil do cliente), e nao devem bloquear a criacao do cadastro.

### Alteracoes

Todas no arquivo `src/pages/Clients.tsx`:

**1. Remover validacao de campos personalizados no salvamento (linhas 821-829)**

Remover o bloco `requiredFields.forEach(...)` que adiciona erros para campos personalizados nao preenchidos. Manter apenas as validacoes basicas (nome, telefone, CPF, CNPJ).

**2. Simplificar o indicador de progresso (linhas 1662-1760)**

Remover os campos personalizados do calculo de `requiredChecks`, mantendo apenas Nome e Telefone. Isso reduz o contador de "0/169" para "0/2" e elimina a lista massiva de badges.

**3. Remover a secao "Campos Obrigatorios" do formulario (linhas 1878-2050)**

Remover completamente o bloco que renderiza os inputs dos campos personalizados obrigatorios (select, multi_select, boolean, text, number, date, user) dentro do dialog de criacao.

### Resultado

- O dialog de criacao fica limpo e rapido, exigindo apenas nome e telefone
- Os campos personalizados continuam existindo no perfil do cliente para preenchimento posterior
- Nenhuma alteracao na estrutura do banco de dados
