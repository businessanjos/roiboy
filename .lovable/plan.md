
# Plano: Separar Responsável de Vendas e Responsável de Operação

## Contexto do Problema

Atualmente existe apenas UM campo `responsible_user_id` na tabela `clients`, que está sendo usado de forma ambígua para dois papéis diferentes:

1. **Vendedor** (Setor Vendas) - fechou a venda, faz contato periódico
2. **Consultor** (Setor Operações) - atende o cliente durante o contrato

O Lead convertido em Cliente DEVE:
- ✅ Ir para a fila de Conciliação (já funciona)
- ✅ Ir para a Triagem da Operação (precisa ter `responsible_user_id` = NULL)
- ✅ Manter o vendedor vinculado (novo campo `sales_user_id`)

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Migração SQL** | Adicionar coluna `sales_user_id` na tabela `clients` |
| `convert_lead_to_client` (função DB) | Atualizar para NÃO copiar `responsible_user_id` do lead |
| `src/pages/SalesPipeline.tsx` | Após conversão, salvar `deal.responsible_user_id` em `clients.sales_user_id` |
| `src/components/contracts/ContractTriageQueue.tsx` | Ordenar por `created_at` DESC e exibir vendedor responsável |
| `src/components/client/ClientHeader.tsx` | Exibir ambos responsáveis (Vendedor + Consultor) |

## Alterações Técnicas

### 1. Migração SQL - Nova Coluna

```sql
-- Adicionar coluna para vendedor responsável
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS sales_user_id uuid REFERENCES public.users(id);

-- Comentário explicativo
COMMENT ON COLUMN public.clients.sales_user_id IS 'Vendedor que fechou a venda (setor Vendas)';
COMMENT ON COLUMN public.clients.responsible_user_id IS 'Consultor responsável pelo atendimento (setor Operações)';
```

### 2. Atualizar Função convert_lead_to_client

Modificar para NÃO copiar `responsible_user_id` do lead para o cliente, garantindo que novos clientes sempre vão para triagem:

```sql
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_client_id uuid;
BEGIN
  -- Buscar lead
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
  
  IF v_lead.converted_to_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido';
  END IF;
  
  -- Criar cliente SEM responsible_user_id (vai para triagem)
  INSERT INTO public.clients (
    account_id, full_name, phone_e164, emails,
    cpf, rg, birth_date, cnpj, company_name,
    business_segment, business_niche, companies,
    street, street_number, complement, neighborhood, city, state, zip_code,
    business_street, business_street_number, business_complement,
    business_neighborhood, business_city, business_state, business_zip_code,
    bank_code, bank_name, bank_agency, bank_account, bank_account_type,
    pix_key, pix_key_type, instagram, instagrams,
    additional_phones, additional_pix_keys, additional_bank_accounts,
    notes, tags, status
    -- responsible_user_id REMOVIDO - cliente vai para triagem
  ) VALUES (
    v_lead.account_id, v_lead.full_name, COALESCE(v_lead.phone, '+5500000000000'),
    COALESCE(v_lead.emails, CASE WHEN v_lead.email IS NOT NULL THEN jsonb_build_array(v_lead.email) ELSE '[]'::jsonb END),
    v_lead.cpf, v_lead.rg, v_lead.birth_date, v_lead.cnpj, v_lead.company_name,
    v_lead.business_segment, v_lead.business_niche, COALESCE(v_lead.companies, '[]'::jsonb),
    v_lead.street, v_lead.street_number, v_lead.complement, v_lead.neighborhood,
    v_lead.city, v_lead.state, v_lead.zip_code,
    v_lead.business_street, v_lead.business_street_number, v_lead.business_complement,
    v_lead.business_neighborhood, v_lead.business_city, v_lead.business_state, v_lead.business_zip_code,
    v_lead.bank_code, v_lead.bank_name, v_lead.bank_agency, v_lead.bank_account, v_lead.bank_account_type,
    v_lead.pix_key, v_lead.pix_key_type, v_lead.instagram, COALESCE(v_lead.instagrams, '[]'::jsonb),
    COALESCE(v_lead.additional_phones, '[]'::jsonb),
    COALESCE(v_lead.additional_pix_keys, '[]'::jsonb),
    COALESCE(v_lead.additional_bank_accounts, '[]'::jsonb),
    v_lead.notes, COALESCE(v_lead.tags, '[]'::jsonb), 'active'
  ) RETURNING id INTO v_client_id;
  
  -- Atualizar lead como convertido
  UPDATE public.leads
  SET converted_to_client_id = v_client_id,
      converted_at = now(),
      status = 'converted'
  WHERE id = p_lead_id;
  
  RETURN v_client_id;
END;
$$;
```

### 3. SalesPipeline.tsx - Salvar Vendedor

Após a conversão do lead e atualização com dados do deal, adicionar:

```typescript
// STEP 4: Update client with deal custom field data (Instagram, City, Bonus)
if (clientId && currentUser?.account_id) {
  await updateClientWithDealData(clientId, currentUser.account_id, dealFieldValues);
  
  // NOVO: Salvar vendedor responsável (sales_user_id)
  // O responsible_user_id permanece NULL para triagem da Operação
  if (deal.responsible_user_id) {
    await supabase
      .from('clients')
      .update({ sales_user_id: deal.responsible_user_id })
      .eq('id', clientId);
  }
}
```

### 4. ContractTriageQueue.tsx - Ordenação + Exibir Vendedor

```typescript
// Ordenar do mais recente para o mais antigo
const triageContracts = useMemo(() => {
  return contracts
    .filter((contract) => !contract.client?.responsible_user_id)
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Mais recente primeiro
    });
}, [contracts]);
```

E na interface Contract, adicionar:

```typescript
interface Contract {
  // ... existente
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    responsible_user_id: string | null;
    sales_user_id: string | null; // NOVO
  };
}
```

Na tabela, adicionar coluna "Vendedor":

```typescript
<TableHead>Vendedor</TableHead>
// ...
<TableCell>
  {contract.client?.sales_user_id ? (
    // Buscar nome do vendedor
    <span className="text-sm text-muted-foreground">
      {salesUserName}
    </span>
  ) : (
    <span className="text-sm text-muted-foreground">-</span>
  )}
</TableCell>
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSO DE VENDA                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Vendedor trabalha o Lead no Pipeline                         │
│    → Deal.responsible_user_id = Vendedor                        │
│                                                                 │
│ 2. Vendedor marca negócio como "Ganho"                          │
│    → Lead convertido para Cliente                               │
│    → Client.sales_user_id = Vendedor (NOVO)                     │
│    → Client.responsible_user_id = NULL (vai para triagem)       │
│    → Contrato criado → Fila de Conciliação                      │
│                                                                 │
│ 3. Cliente aparece na Triagem da Operação                       │
│    → Consultor clica "Puxar" ou CX atribui                      │
│    → Client.responsible_user_id = Consultor                     │
│                                                                 │
│ 4. Cliente agora tem dois responsáveis:                         │
│    → sales_user_id = Vendedor (contato periódico)               │
│    → responsible_user_id = Consultor (atendimento diário)       │
└─────────────────────────────────────────────────────────────────┘
```

## Visualização no Perfil do Cliente

Na área de responsáveis do cliente, exibir ambos:

```text
┌──────────────────────────────────────┐
│ Responsáveis                         │
├──────────────────────────────────────┤
│ 🎯 Consultor: [Avatar] João Silva    │
│ 💼 Vendedor:  [Avatar] Maria Santos  │
└──────────────────────────────────────┘
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Cliente convertido de Lead | Sem responsável OU com responsável errado | `sales_user_id` = Vendedor, `responsible_user_id` = NULL |
| Triagem da Operação | Cliente pode não aparecer | Cliente SEMPRE aparece (sem consultor) |
| Perfil do Cliente | Apenas 1 responsável | 2 responsáveis distintos |
| Ordenação Triagem | Arbitrária | Mais recente primeiro |
