
# Plano: Corrigir Erro "Cliente não encontrado" Causado por Falha de Rede

## Diagnóstico

O erro "Cliente não encontrado" está sendo exibido incorretamente quando ocorre uma **falha de rede transiente** (TypeError: Failed to fetch), em vez de quando o cliente realmente não existe.

### Evidências Encontradas

1. **Logs de Console:** `TypeError: Failed to fetch` - erro de rede, não erro 404
2. **Banco de Dados:** Cliente Dayse Magalhães existe (ID: `a84ef3d0-6dfe-4125-a759-feb4d9dca730`)
3. **Código Atual:** `ClientDetail.tsx` não diferencia entre "não encontrado" e "erro de rede"

### Causa Raiz

Na função `fetchData()` (linha 578-934 de `ClientDetail.tsx`):

```typescript
try {
  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (clientError) {
    console.error("Client fetch error:", clientError);
    throw clientError;  // Joga o erro sem diferenciar o tipo
  }
  
  if (!clientData) {
    console.error("Client not found for ID:", id);
    setLoading(false);
    return;  // Client permanece null
  }
  // ...
} catch (error) {
  console.error("Error fetching client data:", error);
  toast.error("Erro ao carregar dados do cliente");  // Toast genérico
} finally {
  setLoading(false);
}
```

O problema é que **qualquer** erro (rede, RLS, timeout) resulta em `client = null` e a UI exibe "Cliente não encontrado".

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ClientDetail.tsx` | Adicionar estado de erro, retry automático, e UI diferenciada |

## Solução Proposta

### 1. Adicionar Estado de Erro

```typescript
const [fetchError, setFetchError] = useState<{ type: 'network' | 'not_found' | 'permission'; message: string } | null>(null);
```

### 2. Modificar fetchData() para Diferenciar Erros

```typescript
const fetchData = async () => {
  if (!id) return;
  setLoading(true);
  setFetchError(null);  // Reset error state

  try {
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    // Diferenciar tipos de erro
    if (clientError) {
      console.error("Client fetch error:", clientError);
      
      // Erro de rede (Failed to fetch, ETIMEDOUT, etc)
      if (clientError.message?.includes('Failed to fetch') || 
          clientError.message?.includes('NetworkError') ||
          clientError.code === 'PGRST301') {
        setFetchError({ 
          type: 'network', 
          message: 'Erro de conexão. Verifique sua internet.' 
        });
        return;
      }
      
      // Cliente não encontrado (PGRST116 = single row not found)
      if (clientError.code === 'PGRST116') {
        setFetchError({ 
          type: 'not_found', 
          message: 'Cliente não encontrado.' 
        });
        return;
      }
      
      // Erro de permissão (RLS)
      if (clientError.code === '42501' || clientError.code === 'PGRST301') {
        setFetchError({ 
          type: 'permission', 
          message: 'Sem permissão para visualizar este cliente.' 
        });
        return;
      }
      
      // Outros erros
      setFetchError({ 
        type: 'network', 
        message: clientError.message || 'Erro desconhecido.' 
      });
      return;
    }
    
    // ... resto do código existente
  } catch (error: any) {
    console.error("Error fetching client data:", error);
    
    // Tratamento de erros não-Supabase (network errors puros)
    if (error?.message?.includes('Failed to fetch') || 
        error instanceof TypeError) {
      setFetchError({ 
        type: 'network', 
        message: 'Falha na conexão. Tente novamente.' 
      });
    } else {
      setFetchError({ 
        type: 'network', 
        message: error?.message || 'Erro ao carregar dados.' 
      });
    }
  } finally {
    setLoading(false);
  }
};
```

### 3. Modificar UI para Exibir Erros Diferenciados

```typescript
// Tela de erro de rede com botão de retry
if (fetchError?.type === 'network') {
  return (
    <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <p className="text-muted-foreground mb-2">{fetchError.message}</p>
      <Button onClick={() => fetchData()} className="mt-4">
        <RefreshCw className="h-4 w-4 mr-2" />
        Tentar Novamente
      </Button>
    </div>
  );
}

// Cliente realmente não encontrado
if (fetchError?.type === 'not_found' || !client) {
  return (
    <div className="p-6 lg:p-8">
      <p className="text-muted-foreground">Cliente não encontrado.</p>
      <Button asChild className="mt-4">
        <Link to="/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  );
}

// Erro de permissão
if (fetchError?.type === 'permission') {
  return (
    <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <Lock className="h-12 w-12 text-red-500 mb-4" />
      <p className="text-muted-foreground mb-2">{fetchError.message}</p>
      <Button asChild className="mt-4">
        <Link to="/clients">Voltar para Clientes</Link>
      </Button>
    </div>
  );
}
```

### 4. Adicionar Retry Automático para Erros de Rede

```typescript
// No useEffect, adicionar retry automático
useEffect(() => {
  let retryCount = 0;
  const maxRetries = 2;
  
  const fetchWithRetry = async () => {
    await fetchData();
    
    // Se houve erro de rede e ainda tem tentativas, retry após 2 segundos
    if (fetchError?.type === 'network' && retryCount < maxRetries) {
      retryCount++;
      setTimeout(fetchWithRetry, 2000);
    }
  };
  
  fetchWithRetry();
  fetchAvailableForms();
  fetchTeamUsers();
}, [id]);
```

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────┐
│                  CARREGAMENTO DE CLIENTE                   │
├────────────────────────────────────────────────────────────┤
│ 1. Usuário clica no nome do cliente na Triagem            │
│    → Navigate para /clients/{id}                           │
│                                                            │
│ 2. ClientDetail.tsx executa fetchData()                   │
│    → setLoading(true)                                      │
│    → setFetchError(null)                                   │
│                                                            │
│ 3. Consulta Supabase: .from("clients").eq("id", id)       │
│                                                            │
│ 4. Análise do resultado:                                   │
│    ┌─────────────────────────────────────────────────┐     │
│    │ SUCESSO?                                        │     │
│    │ ├─ SIM: setClient(data)                         │     │
│    │ └─ NÃO: Analisar tipo de erro                   │     │
│    │        ├─ Network Error → Retry + UI de retry   │     │
│    │        ├─ PGRST116 → "Cliente não encontrado"   │     │
│    │        └─ 42501 → "Sem permissão"               │     │
│    └─────────────────────────────────────────────────┘     │
│                                                            │
│ 5. UI apropriada baseada no estado:                       │
│    ├─ loading=true → LoadingScreen                         │
│    ├─ fetchError.type='network' → Botão "Tentar Novamente"│
│    ├─ fetchError.type='not_found' → "Não encontrado"       │
│    └─ client → Exibir perfil completo                      │
└────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Erro de rede temporário | "Cliente não encontrado" | UI de erro + botão "Tentar Novamente" |
| Cliente realmente não existe | "Cliente não encontrado" | "Cliente não encontrado" (sem mudança) |
| Sem permissão RLS | "Cliente não encontrado" | "Sem permissão para visualizar" |
| Sucesso | Exibe perfil | Exibe perfil (sem mudança) |

## Imports Adicionais

Adicionar `Lock` aos imports de lucide-react (já existe `RefreshCw`).

## Observação sobre o Problema Atual

O erro que ocorreu com Dayse Magalhães foi um **erro de rede transiente** no preview do Lovable (muito comum durante desenvolvimento). Com esta correção:

1. O usuário verá "Erro de conexão" em vez de "Cliente não encontrado"
2. Um botão "Tentar Novamente" permitirá recarregar sem navegar
3. Retry automático tentará 2x antes de desistir
