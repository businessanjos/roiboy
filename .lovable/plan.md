

## Melhorar tratamento de erro de senha fraca/comprometida

### Problema

A senha "Anjos123!" foi **rejeitada pelo sistema de autenticacao** porque consta em bases de dados de senhas vazadas (Have I Been Pwned). Essa e uma protecao de seguranca ativa -- nao e um bug. Porem, o usuario ve apenas "Edge Function returned a non-2xx status code", sem entender o motivo real.

### Causa raiz nos logs

```
AuthWeakPasswordError: Password is known to be weak and easy to guess
code: "weak_password"
reasons: ["pwned"]
```

### Correcao

**Arquivo: `supabase/functions/update-team-user-password/index.ts`**

No bloco que trata o `updateError` (linha 128-133):
- Detectar quando o erro e do tipo `weak_password` ou contem "weak" na mensagem
- Retornar uma mensagem em portugues clara e orientativa ao usuario

**Arquivo: `src/components/settings/TeamManager.tsx`** (ou componente que chama a Edge Function)

- Melhorar o tratamento da resposta de erro da Edge Function
- Exibir a mensagem de erro retornada pelo servidor em vez de mensagem generica
- Garantir que o `error` do body JSON seja lido e exibido no toast

### Mensagem proposta para o usuario

Quando a senha for rejeitada por ser comprometida:
> "Esta senha foi encontrada em vazamentos de dados conhecidos e nao pode ser utilizada por seguranca. Por favor, escolha uma senha diferente e mais forte."

Quando a senha for fraca por outros motivos:
> "A senha escolhida e muito fraca. Use uma combinacao de letras maiusculas, minusculas, numeros e caracteres especiais."

### Detalhe tecnico

```text
Fluxo atual:
  updateError.code === "weak_password"
  -> return { error: updateError.message }  (mensagem em ingles)
  -> frontend nao le o body -> exibe erro generico

Fluxo corrigido:
  updateError.code === "weak_password" ou updateError.name === "AuthWeakPasswordError"
  -> return { error: "mensagem clara em portugues" }
  -> frontend le o body JSON -> exibe toast com a mensagem real
```

### Resultado esperado

O usuario vera um toast informativo dizendo que a senha escolhida e comprometida e precisa escolher outra, em vez do erro generico "Edge Function returned a non-2xx status code".
