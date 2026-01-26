

# Plano: Corrigir Falha Crítica na Conversão Lead→Cliente e Criação de Contrato

## Diagnóstico Completo

### Evidências do Problema

Analisando os dados do banco de dados para o negócio "Michele Borges":

| Campo | Valor | Problema |
|-------|-------|----------|
| `deal.status` | `won` | ✅ Marcado como ganho |
| `deal.won_at` | `2026-01-26 18:20:36` | ✅ Timestamp presente |
| `deal.client_id` | `null` | ❌ Nunca foi atualizado |
| `lead.status` | `new` | ❌ Deveria ser `converted` |
| `lead.converted_to_client_id` | `null` | ❌ Conversão não ocorreu |
| Contrato criado? | Não | ❌ Fila de conciliação vazia |

O cliente "Michele Borges - RM" foi criado **1h16min depois** manualmente, indicando que o processo automático falhou silenciosamente.

---

## Causa Raiz Identificada

### Falha #1: Tratamento de Erro Assimétrico

O código atual em `SalesPipeline.tsx` (linhas 269-415) tem um problema grave de **ordenação das operações**:

```typescript
// PROBLEMA: O fluxo pode falhar na conversão, mas o deal pode já ter sido
// marcado como ganho por outros caminhos (ex: race condition, chamada duplicada)
```

O `markAsWon(dealId)` (linha 358) **só é chamado depois** da conversão, mas se houver qualquer erro antes, o `return` deveria impedir. Porém, existem cenários onde isso falha:

1. **Duplo clique** no botão "Ganha" pode disparar duas chamadas simultâneas
2. **Timeout de rede** - a primeira chamada inicia a conversão, falha por timeout, mas a segunda completa parcialmente
3. **RPC retornando `null`** sem erro explícito

### Falha #2: RPC `convert_lead_to_client` Pode Retornar Null Silenciosamente

```typescript
const { data: convertedClient, error: convertError } = await supabase
  .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });

if (convertError) {
  // Este bloco NÃO é executado se o RPC retorna null sem erro
  return;
}
clientId = convertedClient; // clientId = null → contrato não é criado!
```

Se o RPC retornar `null` (sem lançar exceção), o código continua com `clientId = null`, e a condição `if (clientId && currentUser?.account_id)` nas linhas 364 e 353 **não cria o contrato**.

### Falha #3: Falta de Validação do `clientId` Antes de Marcar como Ganho

O `markAsWon` é chamado independentemente de ter um `clientId` válido:

```typescript
// Linha 358 - Sempre executa mesmo se clientId for null
await markAsWon(dealId);
```

---

## Solução Proposta

### Correção 1: Validar `clientId` Antes de Prosseguir

Após qualquer tentativa de conversão, verificar explicitamente se `clientId` é válido:

```typescript
// NOVO: Verificação obrigatória após conversão
if (deal.lead_id && !deal.client_id && !clientId) {
  console.error("[MarkAsWon] CRITICAL: Failed to obtain clientId after conversion attempt");
  toast.error("Erro: Não foi possível converter o lead para cliente. Tente novamente.");
  return; // Bloqueia o fluxo
}
```

### Correção 2: Validar Retorno do RPC

```typescript
const { data: convertedClient, error: convertError } = await supabase
  .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });

if (convertError || !convertedClient) {
  console.error("Error converting lead:", convertError || "RPC returned null");
  toast.error("Erro ao converter lead para cliente");
  return;
}
clientId = convertedClient;
```

### Correção 3: Ordem das Operações

Reordenar para garantir atomicidade:

```text
1. Buscar deal e lead
2. Converter lead → cliente (SE necessário)
3. ✅ VALIDAR que clientId existe
4. Atualizar deal.client_id
5. Atualizar dados do cliente (Instagram, Cidade, etc.)
6. Criar contrato na fila de conciliação
7. ✅ SÓ ENTÃO marcar deal como won
8. Enviar notificações
```

### Correção 4: Bloquear Duplo Clique

Adicionar estado de loading para prevenir chamadas duplicadas:

```typescript
const [processingWon, setProcessingWon] = useState<string | null>(null);

const handleMarkAsWon = async (dealId: string) => {
  if (processingWon) {
    toast.warning("Aguarde, processando...");
    return;
  }
  setProcessingWon(dealId);
  try {
    // ... fluxo existente
  } finally {
    setProcessingWon(null);
  }
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/SalesPipeline.tsx` | Reordenar operações, adicionar validações, prevenir duplo clique |
| `src/components/sales/DealDetailSheet.tsx` | Passar estado `processingWon` para desabilitar botão durante processamento |

---

## Código das Correções

### SalesPipeline.tsx - Função `handleMarkAsWon` Corrigida

```typescript
const [processingWonDealId, setProcessingWonDealId] = useState<string | null>(null);

const handleMarkAsWon = async (dealId: string) => {
  // NOVO: Prevenir duplo clique
  if (processingWonDealId) {
    toast.warning("Aguarde, processando negócio anterior...");
    return;
  }
  
  const deal = deals.find(d => d.id === dealId);
  if (!deal) {
    toast.error("Negociação não encontrada");
    return;
  }

  setProcessingWonDealId(dealId);
  
  try {
    let clientId = deal.client_id;
    const dealFieldValues = await fetchDealCustomFieldValues(dealId);
    
    // PASSO 1: Converter lead para cliente (se necessário)
    if (deal.lead_id && !deal.client_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('phone, account_id, converted_to_client_id, status')
        .eq('id', deal.lead_id)
        .single();
      
      if (lead?.converted_to_client_id) {
        clientId = lead.converted_to_client_id;
      } else if (lead?.phone) {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('account_id', lead.account_id)
          .eq('phone_e164', lead.phone)
          .maybeSingle();
        
        if (existingClient) {
          clientId = existingClient.id;
          await supabase
            .from('leads')
            .update({ 
              converted_to_client_id: existingClient.id,
              converted_at: new Date().toISOString(),
              status: 'converted'
            })
            .eq('id', deal.lead_id);
          toast.success("Lead vinculado ao cliente existente!");
        } else {
          const { data: convertedClient, error: convertError } = await supabase
            .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });
          
          // CORREÇÃO: Validar tanto erro quanto retorno null
          if (convertError || !convertedClient) {
            console.error("Error converting lead:", convertError || "RPC returned null");
            toast.error("Erro ao converter lead para cliente. Verifique os dados do lead.");
            return; // Bloqueia o fluxo
          }
          clientId = convertedClient;
          toast.success("Lead convertido para cliente!");
        }
      } else {
        const { data: convertedClient, error: convertError } = await supabase
          .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });
        
        // CORREÇÃO: Validar tanto erro quanto retorno null
        if (convertError || !convertedClient) {
          console.error("Error converting lead:", convertError || "RPC returned null");
          toast.error("Erro ao converter lead para cliente. Verifique os dados do lead.");
          return; // Bloqueia o fluxo
        }
        clientId = convertedClient;
        toast.success("Lead convertido para cliente!");
      }
      
      // PASSO 2: VALIDAÇÃO CRÍTICA - Garantir que temos um clientId
      if (!clientId) {
        console.error("[MarkAsWon] CRITICAL: clientId is null after conversion attempt for deal:", dealId);
        toast.error("Erro crítico: Não foi possível obter o ID do cliente. Tente novamente.");
        return;
      }
      
      // PASSO 3: Atualizar deal com client_id
      const { error: updateDealError } = await supabase
        .from('deals')
        .update({ client_id: clientId })
        .eq('id', dealId);
      
      if (updateDealError) {
        console.error("Error updating deal with client_id:", updateDealError);
        // Continuar mesmo com erro aqui, pois o cliente foi criado
      }
    }

    // PASSO 4: Atualizar cliente com dados do negócio
    if (clientId && currentUser?.account_id) {
      await updateClientWithDealData(clientId, currentUser.account_id, dealFieldValues);
    }

    // PASSO 5: Criar contrato ANTES de marcar como ganho
    if (clientId && currentUser?.account_id) {
      const today = new Date().toISOString().split('T')[0];
      const clientName = deal.client?.full_name || deal.lead?.full_name || deal.contact_name || "";
      const contractDataFromDeal = await getContractDataFromDealFields(dealFieldValues);
      
      const contractData = {
        client_id: clientId,
        account_id: currentUser.account_id,
        start_date: today,
        value: deal.value || 0,
        contract_type: 'Compra',
        status: 'active',
        receivables_generated: false,
        notes: `Contrato gerado automaticamente do negócio: ${deal.title}`,
        product_id: contractDataFromDeal.product_id || null,
        payment_method: contractDataFromDeal.payment_method || null,
        negotiation_description: contractDataFromDeal.negotiation_description || null,
      };

      const { data: newContract, error: contractError } = await supabase
        .from("client_contracts")
        .insert(contractData)
        .select("id")
        .single();

      if (contractError) {
        console.error("Error creating contract:", contractError);
        // DECISÃO: Perguntar ao usuário se deseja continuar sem contrato
        const continueWithoutContract = window.confirm(
          "Houve um erro ao criar o contrato. Deseja marcar como ganho mesmo assim?\n\n" +
          "Você precisará criar o contrato manualmente depois."
        );
        if (!continueWithoutContract) {
          return;
        }
        toast.warning("Negócio será marcado como ganho, mas o contrato precisará ser criado manualmente.");
      } else if (newContract) {
        await notifyContractCreated({
          contractId: newContract.id,
          clientName,
          contractValue: deal.value || 0,
          fromDeal: true,
          createdByUserId: currentUser.id,
          accountId: currentUser.account_id,
        });
      }
    }

    // PASSO 6: AGORA marcar como ganho (só depois de tudo ter sido validado)
    await markAsWon(dealId);
    
    setIsDetailOpen(false);
    setSelectedDeal(null);
    
    toast.success("🎉 Negócio ganho! Contrato enviado para a fila de conciliação.");
    
  } catch (error) {
    console.error("Error marking deal as won:", error);
    toast.error("Erro ao processar ganho. Tente novamente.");
  } finally {
    setProcessingWonDealId(null);
  }
};
```

---

## Resultado Esperado

Após as correções:

1. ✅ **Duplo clique bloqueado** - Apenas uma operação por vez
2. ✅ **Validação do clientId** - Bloqueia o fluxo se a conversão falhar
3. ✅ **Contrato criado ANTES** de marcar como ganho
4. ✅ **Feedback claro** ao usuário em caso de erro
5. ✅ **Logs detalhados** para debugging futuro

---

## Detalhes Técnicos

### Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────┐
│                  handleMarkAsWon                         │
├─────────────────────────────────────────────────────────┤
│ 1. Verificar se já há processamento em andamento        │
│ 2. Buscar deal e lead                                   │
│ 3. Converter lead → cliente (RPC)                       │
│ 4. ⚠️ VALIDAR clientId ≠ null                          │
│ 5. Atualizar deal.client_id                             │
│ 6. Atualizar dados do cliente                           │
│ 7. Criar contrato na fila de conciliação                │
│ 8. ✅ markAsWon(dealId) - SÓ APÓS SUCESSO              │
│ 9. Enviar notificações                                  │
│ 10. Toast de sucesso                                    │
└─────────────────────────────────────────────────────────┘
```

### Cenários de Falha Tratados

| Cenário | Antes | Depois |
|---------|-------|--------|
| RPC retorna null | Contrato não criado, deal marcado como won | Erro exibido, fluxo bloqueado |
| Duplo clique | Duas chamadas simultâneas | Segunda chamada bloqueada |
| Erro ao criar contrato | Deal marcado como won sem contrato | Usuário decide se continua |
| Lead sem telefone | Pode falhar silenciosamente | Erro tratado explicitamente |

