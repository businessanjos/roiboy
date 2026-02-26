

## Corrigir mensagem de erro genérica na criação de contrato

### Problema identificado

A usuária Jéssica Marcato está tentando criar um novo contrato com um novo cliente, mas recebe apenas "Erro ao salvar contrato" sem nenhum detalhe. O problema está no bloco `catch` genérico do `Contracts.tsx` (linha 1364) que captura exceções não tratadas sem exibir a mensagem real do erro:

```typescript
// Linha 1364 - SEM detalhes do erro
toast.error("Erro ao salvar contrato");
```

Enquanto os handlers específicos (criação de cliente na linha 1214, criação de contrato na linha 1327) incluem `error.message`, o catch genérico esconde a causa real. Isso impede o diagnóstico do problema.

### Solução

**Arquivo:** `src/pages/Contracts.tsx`

Alterar o bloco catch genérico (linha 1357-1365) para:

1. Incluir `error.message` no toast de erro para que a mensagem real seja visível ao usuário e facilite o diagnóstico
2. Manter o tratamento especial para violação de telefone duplicado

```typescript
} catch (error: any) {
  console.error("Error saving contract:", error);
  
  if (error?.code === '23505' && error?.message?.includes('phone_e164')) {
    toast.error("Este telefone já está cadastrado para outro cliente. Use 'Selecionar existente'.");
  } else {
    const msg = error?.message || "Erro desconhecido";
    toast.error(`Erro ao salvar contrato: ${msg}`);
  }
}
```

Isso permitirá identificar imediatamente qual é o erro real que a Jéssica está enfrentando (pode ser RLS, constraint de validação, campo obrigatório faltando, etc.) sem necessidade de acessar logs do servidor.

### Arquivo alterado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Contracts.tsx` | Incluir `error.message` no toast genérico de erro para tornar a mensagem descritiva |

