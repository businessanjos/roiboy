
# Plano: Exibir Perguntas dos Formulários com Nome Correto

## Problema Identificado

Na aba "Fichas" do perfil do cliente, as perguntas estão sendo exibidas como UUIDs (ex: `037acfbd-856b-4ea6-b1d3-bfe10014dd61`) ao invés do texto da pergunta (ex: "Animal de Estimação").

### Causa Raiz

O componente `ClientFormResponses.tsx` busca `forms.fields` que contém apenas **IDs** dos campos:

```typescript
// forms.fields = ["037acfbd-...", "0c01f67a-...", ...]  ← Array de UUIDs!
```

A função `getFieldLabel` tenta encontrar um objeto `{ id, label }` no array, mas como só existem IDs, ela retorna o próprio UUID como fallback:

```typescript
const getFieldLabel = (form, fieldId): string => {
  if (!form?.fields) return fieldId;
  const field = form.fields.find((f: any) => f.id === fieldId);
  return field?.label || fieldId;  // ← Sempre retorna fieldId pois não há .label
};
```

Os labels reais estão na tabela `custom_fields`:
- `id: 037acfbd-856b-4ea6-b1d3-bfe10014dd61` → `name: "Animal de Estimação"`
- `id: 0c01f67a-b0b1-423e-af36-7fd4fb91b016` → `name: "Descrição do Negócio"`

## Solução

Modificar o `ClientFormResponses.tsx` para:
1. Buscar o `account_id` do cliente
2. Buscar todos os `custom_fields` dessa conta
3. Criar um mapa `fieldId → fieldName`
4. Usar esse mapa para traduzir IDs em labels legíveis

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/client/ClientFormResponses.tsx` | Buscar custom_fields e usar para exibir labels |

## Mudanças Detalhadas

### 1. Adicionar Estado para Custom Fields

```typescript
const [customFieldsMap, setCustomFieldsMap] = useState<Map<string, string>>(new Map());
```

### 2. Modificar fetchData para Buscar Custom Fields

```typescript
const fetchData = async () => {
  setLoading(true);
  try {
    // Primeiro, buscar o account_id do cliente
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("account_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    const accountId = clientData?.account_id;

    // Buscar custom_fields para obter os nomes
    if (accountId) {
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("id, name")
        .eq("account_id", accountId);

      if (!fieldsError && fieldsData) {
        const fieldsMap = new Map(fieldsData.map(f => [f.id, f.name]));
        setCustomFieldsMap(fieldsMap);
      }
    }

    // ... resto da lógica existente (form_responses e diagnostics)
  }
};
```

### 3. Modificar getFieldLabel para Usar o Mapa

```typescript
const getFieldLabel = (fieldId: string): string => {
  // Primeiro tenta buscar no mapa de custom_fields
  const customFieldName = customFieldsMap.get(fieldId);
  if (customFieldName) return customFieldName;
  
  // Fallback: retorna o ID (não deveria acontecer, mas é seguro)
  return fieldId;
};
```

### 4. Atualizar Chamada da Função

```typescript
// Antes (não funcionava):
{getFieldLabel(response.forms, fieldId)}

// Depois (funciona):
{getFieldLabel(fieldId)}
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| `037acfbd-856b-4ea6-b1d3-bfe10014dd61` | Animal de Estimação |
| `0c01f67a-b0b1-423e-af36-7fd4fb91b016` | Descrição do Negócio |
| `0d59427c-053c-47ea-8f41-3d0e8b667523` | Time de Futebol |

## Código Final do Componente (Trechos Modificados)

```typescript
export function ClientFormResponses({ clientId }: ClientFormResponsesProps) {
  const [loading, setLoading] = useState(true);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [customFieldsMap, setCustomFieldsMap] = useState<Map<string, string>>(new Map()); // NOVO

  const fetchData = async () => {
    setLoading(true);
    try {
      // NOVO: Buscar account_id do cliente
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("account_id")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      const accountId = clientData?.account_id;

      // NOVO: Buscar custom_fields para mapeamento de labels
      if (accountId) {
        const { data: fieldsData } = await supabase
          .from("custom_fields")
          .select("id, name")
          .eq("account_id", accountId);

        if (fieldsData) {
          setCustomFieldsMap(new Map(fieldsData.map(f => [f.id, f.name])));
        }
      }

      // ... fetch form_responses e diagnostics (código existente)
    }
  };

  // MODIFICADO: Usa o mapa ao invés de tentar achar no form.fields
  const getFieldLabel = (fieldId: string): string => {
    return customFieldsMap.get(fieldId) || fieldId;
  };
```

## Impacto

- **Performance**: Adiciona 2 queries leves (account_id e custom_fields) que serão cacheadas
- **Compatibilidade**: Não afeta campos que não existem (retorna ID como fallback)
- **Todas as fichas**: Funcionará para qualquer formulário preenchido pelo cliente
