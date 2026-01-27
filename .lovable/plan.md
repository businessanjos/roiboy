
# Plano: Adicionar Botão "+ Novo Lançamento" na Aba Financeiro do Cliente

## Objetivo

Permitir que usuários com permissão (Admin ou Financeiro) criem lançamentos financeiros diretamente da aba "Financeiro" do perfil do cliente, com o cliente já pré-selecionado no formulário.

## Resumo da Funcionalidade

- Adicionar botão "+ Novo Lançamento" ao lado do botão "Sincronizar Omie"
- Botão abre o seletor de método de inserção (NF-e, Código de Barras, Manual)
- Ao selecionar "Inserção Manual", o formulário já vem com o cliente atual pré-preenchido
- Botão visível apenas para usuários com Team Role "Admin", "Financeiro" ou "Gestor"
- Lançamento criado será vinculado automaticamente ao cliente atual

## Componentes a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/client/ClientFinancial.tsx` | Adicionar botão, estados e dialogs |

## Fluxo do Usuário

```text
1. Usuário acessa perfil do cliente → aba "Financeiro"
2. Vê botão "+ Novo Lançamento" ao lado de "Sincronizar Omie"
3. Clica no botão → abre modal com 3 opções:
   - Nota Fiscal Eletrônica (em desenvolvimento)
   - Código de Barras (em desenvolvimento)
   - Inserção Manual ← funcional
4. Seleciona "Inserção Manual"
5. Formulário abre com cliente já selecionado
6. Preenche dados e salva
7. Lançamento aparece na lista do cliente
```

## Controle de Acesso

Apenas usuários com as seguintes Team Roles terão acesso ao botão:
- **Admin** - Permissão total
- **Financeiro** - Responsável pelo setor financeiro
- **Gestor** - Papel de gestão geral

A verificação será feita usando `currentUser.team_role_name` do hook `useCurrentUser`, que já está importado no componente.

## Seção Técnica

### 1. Imports a Adicionar

```typescript
import { Plus } from "lucide-react";
import { ReceivableMethodSelector, ReceivableMethod } from "@/components/financial/ReceivableMethodSelector";
import { ManualReceivableDialog, ReceivableFormData } from "@/components/financial/ManualReceivableDialog";
import { NfeImportDialog } from "@/components/financial/NfeImportDialog";
import { BarcodeImportDialog } from "@/components/financial/BarcodeImportDialog";
```

### 2. Constante para Roles Permitidas

```typescript
const FINANCIAL_ALLOWED_ROLES = ["Admin", "Financeiro", "Gestor"];
```

### 3. Novos Estados

```typescript
const [isReceivableMethodOpen, setIsReceivableMethodOpen] = useState(false);
const [isManualReceivableOpen, setIsManualReceivableOpen] = useState(false);
const [isNfeReceivableOpen, setIsNfeReceivableOpen] = useState(false);
const [isBarcodeReceivableOpen, setIsBarcodeReceivableOpen] = useState(false);
```

### 4. Verificação de Permissão

```typescript
const canAddEntry = 
  currentUser?.role === "admin" || 
  currentUser?.is_also_admin === true ||
  FINANCIAL_ALLOWED_ROLES.includes(currentUser?.team_role_name || "");
```

### 5. Função para Salvar Lançamento

```typescript
const handleSaveReceivable = async (data: ReceivableFormData) => {
  if (!currentUser?.account_id) return;

  const { error } = await supabase.from("financial_entries").insert({
    account_id: currentUser.account_id,
    entry_type: "receivable",
    description: data.client_name || "Receita",
    amount: parseFloat(data.amount.replace(",", ".")) || 0,
    due_date: data.due_date,
    category_id: data.category_id || null,
    bank_account_id: data.bank_account_id || null,
    client_id: data.client_id || clientId, // Garante vínculo com cliente atual
    is_recurring: data.is_recurring,
    recurrence_type: data.is_recurring ? data.recurrence_type : null,
    recurrence_end_date: data.is_recurring && data.recurrence_end_date ? data.recurrence_end_date : null,
    document_number: data.document_number || null,
    notes: data.notes || null,
    status: "pending",
    currency: "BRL",
    issue_date: data.issue_date || null,
    expected_date: data.expected_date || null,
    seller_id: data.seller_id || null,
    project_id: data.project_id || null,
  });

  if (error) {
    toast.error(`Erro ao criar lançamento: ${error.message}`);
  } else {
    toast.success("Lançamento criado com sucesso!");
    fetchFinancialEntries(clientData); // Atualiza lista
    setIsManualReceivableOpen(false);
  }
};
```

### 6. Botão no Header (ao lado de Sincronizar Omie)

```typescript
<div className="flex justify-between items-center gap-2 flex-wrap">
  <div className="flex items-center gap-3">
    <h3 className="font-medium">Dados Financeiros</h3>
    <ClientFinancialStatusBadge clientId={clientId} size="lg" />
  </div>
  <div className="flex items-center gap-2">
    {canAddEntry && (
      <Button 
        size="sm" 
        onClick={() => setIsReceivableMethodOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Novo Lançamento
      </Button>
    )}
    <Button 
      size="sm" 
      variant="outline" 
      onClick={handleSyncOmie}
      disabled={syncing}
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Sincronizar Omie
    </Button>
  </div>
</div>
```

### 7. Dialogs no Final do Componente

```typescript
{/* Seletor de Método de Recebimento */}
<ReceivableMethodSelector
  open={isReceivableMethodOpen}
  onOpenChange={setIsReceivableMethodOpen}
  onSelect={(method: ReceivableMethod) => {
    if (method === "manual") {
      setIsManualReceivableOpen(true);
    } else if (method === "nfe") {
      setIsNfeReceivableOpen(true);
    } else if (method === "barcode") {
      setIsBarcodeReceivableOpen(true);
    }
  }}
/>

{/* Dialog Manual com cliente pré-preenchido */}
<ManualReceivableDialog
  open={isManualReceivableOpen}
  onOpenChange={setIsManualReceivableOpen}
  onSave={handleSaveReceivable}
  editingEntry={{
    ...initialFormData,
    client_id: clientId,
    client_name: clientData?.company_name || "",
  }}
/>

{/* NFe e Barcode (em desenvolvimento) */}
<NfeImportDialog
  open={isNfeReceivableOpen}
  onOpenChange={setIsNfeReceivableOpen}
  onImport={async () => {
    toast.info("Importação de NF-e em desenvolvimento");
    setIsNfeReceivableOpen(false);
  }}
/>

<BarcodeImportDialog
  open={isBarcodeReceivableOpen}
  onOpenChange={setIsBarcodeReceivableOpen}
  onContinue={async () => {
    toast.info("Importação de código de barras em desenvolvimento");
    setIsBarcodeReceivableOpen(false);
  }}
/>
```

## Resultado Esperado

O botão "+ Novo Lançamento" aparecerá ao lado de "Sincronizar Omie" apenas para usuários autorizados. Ao clicar, o usuário poderá escolher o método de inserção. Ao selecionar "Inserção Manual", o formulário abrirá com o cliente atual já selecionado, facilitando o cadastro e garantindo que o lançamento seja vinculado corretamente ao perfil do cliente.
