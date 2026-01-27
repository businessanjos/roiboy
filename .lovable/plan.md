

# Plano: Melhorar Tratamento de Erros na Criação de Contrato

## Problema Identificado

O erro "Erro ao salvar contrato" é exibido de forma genérica, sem indicar a causa real. A investigação dos logs do banco de dados não revelou erros específicos de `client_contracts`, sugerindo que:

1. O erro pode estar ocorrendo na **criação do cliente** (antes do contrato)
2. O erro pode ser de **RLS/permissões** que não aparece nos logs postgres
3. A mensagem de erro está sendo **engolida** pelo catch genérico

## Solucao Proposta

Melhorar o tratamento de erros para exibir mensagens específicas e adicionar logs de debug para facilitar a identificação do problema.

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Contracts.tsx` | Adicionar tratamento de erro detalhado e logs de debug |

## Alteracoes Tecnicas

```typescript
// Em handleSaveContract, linhas ~1186-1320

// 1. Adicionar log antes de criar cliente
console.log('[Contract] Creating new client:', {
  full_name: clientFormData.full_name,
  phone: clientFormData.phone_e164,
  account_id: userProfile.account_id
});

const { data: newClient, error: createClientError } = await supabase
  .from("clients")
  .insert(newClientData as any)
  .select("id")
  .single();

if (createClientError) {
  console.error('[Contract] Client creation error:', createClientError);
  // Mensagem especifica para erro de cliente
  if (createClientError.code === '23505') {
    toast.error("Este telefone ja esta cadastrado. Use 'Selecionar existente'.");
  } else if (createClientError.code === '42501') {
    toast.error("Sem permissao para criar cliente. Verifique suas credenciais.");
  } else {
    toast.error(`Erro ao criar cliente: ${createClientError.message}`);
  }
  setSaving(false);
  return;
}

// 2. Adicionar log antes de criar contrato
console.log('[Contract] Creating contract:', {
  client_id: clientId,
  start_date: formData.start_date,
  value: formData.value,
  status: isFutureStart ? "scheduled" : "active"
});

const { data: newContract, error } = await supabase
  .from("client_contracts")
  .insert(contractData as any)
  .select("id")
  .single();

if (error) {
  console.error('[Contract] Contract creation error:', error);
  // Mensagens especificas por tipo de erro
  if (error.code === '23503') {
    toast.error("Cliente ou produto invalido. Verifique os dados.");
  } else if (error.code === '23514') {
    toast.error("Status do contrato invalido.");
  } else if (error.code === '42501') {
    toast.error("Sem permissao para criar contrato.");
  } else {
    toast.error(`Erro ao salvar contrato: ${error.message}`);
  }
  setSaving(false);
  return;
}
```

## Beneficios

1. **Mensagens claras**: Usuario sabera exatamente o que falhou
2. **Logs de debug**: Console mostrara dados enviados para identificar problemas
3. **Tratamento especifico**: Cada tipo de erro (duplicidade, permissao, FK) tem mensagem propria
4. **Nao interrompe fluxo**: Se cliente falhar, nao tenta criar contrato

## Resultado Esperado

Em vez de "Erro ao salvar contrato", o usuario vera mensagens como:
- "Este telefone ja esta cadastrado. Use 'Selecionar existente'."
- "Erro ao criar cliente: [mensagem especifica do banco]"
- "Sem permissao para criar contrato."

