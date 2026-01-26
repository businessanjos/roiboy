
# Plano: Adicionar "Item da Venda" ao Dialog "Criar Negócio" da Aba Leads

## Contexto

O campo "Item da Venda" já existe no modal "Nova Negociação" do Pipeline (`DealDialog.tsx`), permitindo selecionar um produto e auto-preencher o valor do negócio. Esse campo precisa ser replicado no modal "Criar Negócio" da aba Leads (`LeadsTab.tsx`).

---

## Mudanças Necessárias

### 1. Adicionar Estado para Produtos

Adicionar o estado `products` e `selectedProductId` no componente `LeadsTab`:

```typescript
// Interface para produtos
interface Product {
  id: string;
  name: string;
  price: number;
}

// Estados
const [products, setProducts] = useState<Product[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
```

### 2. Carregar Produtos do Banco

Criar um `useEffect` para buscar produtos ativos quando o usuário abrir o dialog de criação de negócio:

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

### 3. Adicionar Campo "Item da Venda" ao Formulário

Inserir o selector de produtos no formulário `deal-form`, entre "Título" e "Valor":

```typescript
{/* Item da Venda + Valor em grid de 2 colunas */}
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Item da Venda</Label>
    <Select
      value={selectedProductId}
      onValueChange={(productId) => {
        setSelectedProductId(productId);
        // Auto-preencher valor com preço do produto
        if (productId && productId !== "__none__") {
          const product = products.find(p => p.id === productId);
          if (product) {
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
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(product.price)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  
  <div className="space-y-2">
    <Label>Valor (R$)</Label>
    <Input
      type="number"
      placeholder="0,00"
      value={dealFormData.value}
      onChange={(e) =>
        setDealFormData({ ...dealFormData, value: e.target.value })
      }
    />
  </div>
</div>
```

### 4. Incluir `product_id` na Criação do Negócio

Modificar a função `handleCreateDeal` para enviar o `product_id` selecionado:

```typescript
const handleCreateDeal = async () => {
  setCreatingDeal(true);
  try {
    const productId = selectedProductId && selectedProductId !== "__none__" 
      ? selectedProductId 
      : undefined;

    if (existingClient) {
      const deal = await createDeal({
        title: dealFormData.title || `Novo negócio - ${existingClient.full_name}`,
        client_id: existingClient.id,
        stage_id: dealFormData.stage_id || undefined,
        value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
        notes: dealFormData.notes || undefined,
        product_id: productId, // ← ADICIONADO
      });
      // ... resto do código
    } else if (leadForDeal) {
      const deal = await createDeal({
        title: dealFormData.title || `Novo negócio - ${leadForDeal.full_name}`,
        lead_id: leadForDeal.id,
        contact_name: leadForDeal.full_name,
        contact_phone: leadForDeal.phone || undefined,
        contact_email: leadForDeal.email || undefined,
        stage_id: dealFormData.stage_id || undefined,
        value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
        notes: dealFormData.notes || leadForDeal.notes || undefined,
        source: leadForDeal.source || undefined,
        product_id: productId, // ← ADICIONADO
      });
      // ... resto do código
    }
  } catch (error) {
    console.error("Error creating deal:", error);
    toast.error("Erro ao criar negócio");
  } finally {
    setCreatingDeal(false);
  }
};
```

### 5. Resetar Estado ao Fechar Dialog

Atualizar a função `resetForm` para limpar o produto selecionado:

```typescript
const resetForm = () => {
  // ... campos existentes
  setSelectedProductId(""); // ← ADICIONADO
};
```

---

## Fluxo de Funcionamento

```text
1. Usuário clica em "Criar Negócio" no menu de um Lead
2. Dialog abre com formulário de negócio
3. Produtos são carregados do banco (is_active = true)
4. Usuário seleciona "Item da Venda"
5. Campo "Valor" é automaticamente preenchido com preço do produto
6. Ao clicar "Criar Negócio":
   - createDeal() recebe product_id
   - useDeals salva na tabela deal_field_values
7. O negócio é criado com produto associado
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sales/LeadsTab.tsx` | Adicionar estado, fetch de produtos, campo no form e incluir `product_id` no `createDeal` |

---

## Resultado Visual Esperado

O dialog "Criar Negócio" da aba Leads terá a mesma estrutura do "Nova Negociação" do Pipeline:

- **Título do Negócio**
- **Item da Venda** | **Valor (R$)** ← layout em 2 colunas
- **Etapa**
- **Observações**

Quando o usuário selecionar um produto, o valor será automaticamente preenchido, mas poderá ser alterado manualmente.
