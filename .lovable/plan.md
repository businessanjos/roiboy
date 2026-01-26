

# Plano: Adicionar Campo "Item da Venda" em Todos os Diálogos de Criação de Negócio

## Diagnóstico

A alteração anterior foi feita no arquivo **`src/components/sales/LeadsTab.tsx`**, porém o usuário está acessando a página **`src/pages/Leads.tsx`** (rota `/setores`), que é um arquivo completamente diferente e não possui o campo "Item da Venda".

### Arquivos que precisam do campo "Item da Venda":

| Arquivo | Localização do Dialog | Status Atual |
|---------|----------------------|--------------|
| `src/components/sales/LeadsTab.tsx` | Dialog "Criar Negócio" | Já implementado |
| `src/pages/Leads.tsx` | Dialog "Criar Negócio" (linhas 1647-1760) | **Faltando** |
| `src/components/client/ClientDeals.tsx` | Dialog "Criar Negócio" (linhas 560-605) | **Faltando** |
| `src/components/royzapp/ZappCRMPanel.tsx` | Form "Criar Negócio" (linhas 677-726) | **Faltando** |

---

## Mudanças Necessárias

### 1. `src/pages/Leads.tsx`

**Adicionar estado para produtos:**
```typescript
// Interface para produtos (após linha 103)
interface Product {
  id: string;
  name: string;
  price: number;
}

// Dentro do componente (após linha 178)
const [products, setProducts] = useState<Product[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
```

**Adicionar useEffect para carregar produtos:**
```typescript
useEffect(() => {
  const loadProducts = async () => {
    if (!currentUser?.account_id) return;
    
    const { data } = await supabase
      .from("products")
      .select("id, name, price")
      .eq("account_id", currentUser.account_id)
      .eq("is_active", true)
      .order("name");
    
    setProducts(data || []);
  };
  
  if (dialogStep === 'deal-form') {
    loadProducts();
  }
}, [dialogStep, currentUser?.account_id]);
```

**Adicionar campo no formulário (entre "Título" e "Valor/Etapa"):**
- Seletor de produto com auto-preenchimento do valor

**Atualizar função `handleCreateDeal`:**
- Incluir `product_id` na criação do deal

**Atualizar `resetForm`:**
- Limpar `selectedProductId`

---

### 2. `src/components/client/ClientDeals.tsx`

**Adicionar estado para produtos:**
```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

const [products, setProducts] = useState<Product[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
```

**Adicionar useEffect para carregar produtos quando dialog abre:**
```typescript
useEffect(() => {
  const loadProducts = async () => {
    // ... fetch products
  };
  
  if (isDialogOpen) {
    loadProducts();
  }
}, [isDialogOpen]);
```

**Adicionar campo no formulário (entre "Título" e grid de Valor/Etapa):**
- Seletor de produto idêntico ao LeadsTab

**Atualizar função `handleCreateDeal`:**
- Inserir dados em `deal_field_values` após criar o deal (para armazenar product_id)

---

### 3. `src/components/royzapp/ZappCRMPanel.tsx`

**Adicionar estado para produtos:**
```typescript
const [products, setProducts] = useState<Product[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
```

**Adicionar fetch de produtos:**
- Usar useQuery ou fetch manual ao montar o componente

**Adicionar campo no formulário (entre "Título" e "Valor"):**
- Seletor de produto com estilos ZApp (bg-zapp-bg, border-zapp-border, etc.)

**Atualizar mutation `createDeal`:**
- Após criar o deal, inserir registro em `deal_field_values` com o `product_id`

---

## Estrutura do Campo "Item da Venda"

Em todos os locais, o campo terá a mesma estrutura:

```typescript
<div className="space-y-2">
  <Label>Item da Venda</Label>
  <Select
    value={selectedProductId}
    onValueChange={(productId) => {
      setSelectedProductId(productId);
      if (productId && productId !== "__none__") {
        const product = products.find(p => p.id === productId);
        if (product) {
          // Auto-preencher valor
          setDealFormData(prev => ({
            ...prev,
            value: product.price.toString()
          }));
        }
      }
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecione o produto" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="__none__">Nenhum</SelectItem>
      {products.map(product => (
        <SelectItem key={product.id} value={product.id}>
          <div className="flex items-center justify-between w-full gap-2">
            <span>{product.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(product.price)}
            </span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

## Persistência do Product ID

O `product_id` é armazenado em `deal_field_values` com o `field_id` correto:
- **Field ID:** `033b91fb-3add-4c96-aec9-567fefbd0fb2` ("Item da Venda")

### Para arquivos que usam o hook `useDeals`:
O hook já suporta `product_id` no objeto passado para `createDeal()`.

### Para arquivos com insert direto (ClientDeals, ZappCRMPanel):
Após o insert do deal, inserir em `deal_field_values`:

```typescript
if (selectedProductId && selectedProductId !== "__none__") {
  await supabase.from("deal_field_values").insert({
    deal_id: newDeal.id,
    field_id: "033b91fb-3add-4c96-aec9-567fefbd0fb2",
    account_id: currentUser.account_id,
    value_text: selectedProductId,
  });
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Leads.tsx` | Adicionar estado, fetch, campo UI e product_id no createDeal |
| `src/components/client/ClientDeals.tsx` | Adicionar estado, fetch, campo UI e insert em deal_field_values |
| `src/components/royzapp/ZappCRMPanel.tsx` | Adicionar estado, fetch, campo UI (estilo ZApp) e insert em deal_field_values |

---

## Resultado Esperado

Todos os diálogos de criação de negócio terão o campo "Item da Venda":

1. Pipeline (`DealDialog.tsx`) - Já funciona
2. Leads Tab (`LeadsTab.tsx`) - Já funciona
3. Página Leads (`Leads.tsx`) - Será implementado
4. Cliente Deals (`ClientDeals.tsx`) - Será implementado
5. ROY zAPP CRM Panel (`ZappCRMPanel.tsx`) - Será implementado

O comportamento será idêntico em todos: ao selecionar um produto, o valor é automaticamente preenchido, e o `product_id` é persistido para uso na conversão para contrato.

