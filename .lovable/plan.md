

## Corrigir erro ao atualizar status do contrato

### Problema identificado

O `handleSave` no `ContractDetailSheet.tsx` captura qualquer erro mas exibe apenas a mensagem generica "Erro ao atualizar contrato", escondendo a causa real. Alem disso, ha dois problemas potenciais no envio dos dados:

1. **Formato de `cancelled_at`**: O campo e do tipo `timestamp with time zone` no banco, mas o formulario pode enviar uma string no formato `"2025-02-13"` (apenas data), que pode ser rejeitada pelo PostgREST em certas configuracoes.
2. **`status_changed_at` nao e atualizado**: Quando o status muda, o campo `status_changed_at` nao e enviado na atualizacao, perdendo o rastreamento de quando a mudanca ocorreu.

### Mudancas tecnicas

**Arquivo: `src/components/contracts/ContractDetailSheet.tsx`**

1. **Melhorar log e exibicao do erro real** (linhas 256-258): Alterar o `catch` para mostrar a mensagem real do erro no toast e logar o objeto completo:

```typescript
} catch (error: any) {
  console.error("Error updating contract:", error);
  const errorMsg = error?.message || error?.details || "Erro desconhecido";
  toast.error(`Erro ao atualizar contrato: ${errorMsg}`);
}
```

2. **Formatar `cancelled_at` como timestamp ISO completo** (linha 236): Converter a data para um timestamp valido ao inves de enviar apenas a data:

```typescript
cancelled_at: formData.cancelled_at 
  ? new Date(formData.cancelled_at + "T00:00:00").toISOString() 
  : null,
```

3. **Adicionar `status_changed_at` quando o status muda** (linha 233-244): Detectar se o status mudou e atualizar o campo:

```typescript
const statusChanged = contract.status !== formData.status;
const updateData = {
  ...campos existentes,
  status_changed_at: statusChanged ? new Date().toISOString() : contract.status_changed_at,
};
```

### Resultado esperado

- O erro real sera exibido no toast para diagnostico
- O `cancelled_at` sera enviado em formato ISO compativel com `timestamptz`
- O `status_changed_at` sera atualizado corretamente quando o status mudar
- A atualizacao do contrato para "Encerrado" (ou qualquer outro status) funcionara sem erros

