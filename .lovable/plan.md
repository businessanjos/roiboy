
# Plano: Substituir Select de Clientes por Barra de Pesquisa Flexível

## Problema Identificado

O componente `FormResponseViewer.tsx` usa um `<Select>` simples para vincular clientes ao formulário, com dois problemas críticos:

| Problema | Causa |
|----------|-------|
| **Sem pesquisa** | O `<Select>` não possui funcionalidade de busca |
| **Lista incompleta** | A query em `Forms.tsx` (linha 700-705) não tem limite explícito, mas por ser um simples `.order("full_name")` sem paginação, está sujeita ao limite de 1000 rows do Supabase - além disso, renderizar todos os clientes de uma vez é ineficiente |

## Solução

Transformar o campo de seleção em uma **barra de pesquisa com debounce** que busca clientes server-side, similar ao padrão já implementado em `EventParticipantsTab.tsx` e `Contracts.tsx`.

### Comportamento Esperado

1. Usuário digita no campo de busca (mínimo 2 caracteres)
2. Após 300ms de debounce, busca é executada server-side
3. Busca flexível: "Tiago" encontra "Thiago Henrique Alhier Gomes"
4. Resultados exibidos em lista clicável
5. Ao selecionar, cliente é vinculado

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/forms/FormResponseViewer.tsx` | Substituir `<Select>` por `<Input>` com busca + lista de resultados |
| `src/pages/Forms.tsx` | Remover `fetchClients()` e prop `allClients` (não será mais necessário carregar todos) |

## Mudanças Detalhadas

### 1. FormResponseViewer.tsx - Adicionar Estados e Função de Busca

```typescript
// Novos imports
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Novos estados (dentro do componente)
const { currentUser } = useCurrentUser();
const [clientSearchTerm, setClientSearchTerm] = useState("");
const [searchResults, setSearchResults] = useState<Array<{ id: string; full_name: string; phone_e164: string; avatar_url?: string }>>([]);
const [searchingClients, setSearchingClients] = useState(false);

// Função de busca server-side
const searchClients = async (term: string) => {
  if (!term || term.length < 2 || !currentUser?.account_id) {
    setSearchResults([]);
    return;
  }
  
  setSearchingClients(true);
  try {
    // Dividir termo em múltiplas palavras para busca flexível
    const terms = term.trim().split(/\s+/).filter(t => t.length > 0);
    
    let query = supabase
      .from("clients")
      .select("id, full_name, phone_e164, avatar_url")
      .eq("account_id", currentUser.account_id)
      .order("full_name")
      .limit(20);
    
    // Busca flexível: cada termo deve aparecer no nome
    if (terms.length === 1) {
      query = query.or(`full_name.ilike.%${terms[0]}%,phone_e164.ilike.%${terms[0]}%`);
    } else {
      // Para múltiplos termos, todos devem aparecer no nome
      const conditions = terms.map(t => `full_name.ilike.%${t}%`);
      query = query.or(conditions.join(','));
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    setSearchResults(data || []);
  } catch (error) {
    console.error("Error searching clients:", error);
    setSearchResults([]);
  } finally {
    setSearchingClients(false);
  }
};

// useEffect com debounce
useEffect(() => {
  const timer = setTimeout(() => {
    searchClients(clientSearchTerm);
  }, 300);
  return () => clearTimeout(timer);
}, [clientSearchTerm, currentUser?.account_id]);

// Reset ao trocar de resposta
useEffect(() => {
  setClientSearchTerm("");
  setSearchResults([]);
  setLinkingClientId("");
}, [selectedResponse?.id]);
```

### 2. FormResponseViewer.tsx - Substituir UI do Select

Substituir o bloco de `<Select>` (linhas 598-619) por:

```tsx
<div className="space-y-2 p-3 rounded-lg bg-muted/50">
  <div className="flex items-center gap-2">
    <div className="flex-1 relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar cliente por nome ou telefone..."
        value={clientSearchTerm}
        onChange={(e) => setClientSearchTerm(e.target.value)}
        className="pl-9"
      />
    </div>
    {linkingClientId && (
      <Button
        size="sm"
        onClick={handleSaveToClient}
        disabled={savingToClient}
      >
        {savingToClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Vincular
      </Button>
    )}
  </div>
  
  {/* Lista de resultados */}
  {clientSearchTerm.length >= 2 && (
    <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
      {searchingClients ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : searchResults.length === 0 ? (
        <div className="p-3 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado
        </div>
      ) : (
        searchResults.map((client) => (
          <button
            key={client.id}
            onClick={() => {
              setLinkingClientId(client.id);
              setClientSearchTerm(client.full_name);
              setSearchResults([]);
            }}
            className={cn(
              "w-full flex items-center gap-3 p-2 hover:bg-muted text-left transition-colors",
              linkingClientId === client.id && "bg-muted"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={client.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {client.full_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{client.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.phone_e164}</p>
            </div>
            {linkingClientId === client.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </button>
        ))
      )}
    </div>
  )}
  
  {/* Mensagem quando não digitou ainda */}
  {clientSearchTerm.length < 2 && !linkingClientId && (
    <p className="text-xs text-muted-foreground text-center py-2">
      Digite ao menos 2 caracteres para buscar
    </p>
  )}
  
  {/* Cliente selecionado (visual feedback) */}
  {linkingClientId && clientSearchTerm.length < 2 && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Check className="h-4 w-4 text-primary" />
      Cliente selecionado. Clique em "Vincular" para confirmar.
    </div>
  )}
</div>
```

### 3. Forms.tsx - Remover Carregamento de Todos os Clientes

Remover:
- Estado `allClients` (linha 642)
- Função `fetchClients()` (linhas 698-709)
- Chamada `fetchClients()` no useEffect
- Prop `clients={allClients}` na chamada do FormResponseViewer (linha 1971)

### 4. FormResponseViewer.tsx - Atualizar Props

Remover a prop `clients` da interface:

```typescript
interface FormResponseViewerProps {
  responses: FormResponse[];
  customFields: CustomField[];
  formFields: string[];
  formTitle: string;
  onSaveToClient: (responseId: string, clientId: string) => Promise<void>;
  // REMOVER: clients?: Array<{ id: string; full_name: string; phone_e164: string }>;
}
```

## Resultado Final

| Antes | Depois |
|-------|--------|
| Select com lista estática de ~1000 clientes | Input com busca dinâmica |
| Sem pesquisa | Pesquisa flexível por nome ou telefone |
| Lista para na letra "R" | Busca qualquer cliente do sistema |
| Carrega todos clientes no load da página | Busca sob demanda (mais eficiente) |
| "Tiago" não encontra "Thiago" | "Tiago" encontra "Thiago Henrique Alhier Gomes" |

## Busca Flexível Detalhada

A busca será inteligente:
- **Termo único**: Busca em `full_name` e `phone_e164`
- **Múltiplos termos**: Cada termo deve aparecer no nome (AND implícito)
- **Case insensitive**: "tiago" encontra "THIAGO"
- **Limite 20 resultados**: Performance otimizada
- **Debounce 300ms**: Evita chamadas excessivas
