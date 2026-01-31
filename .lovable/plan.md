
# Plano: Correção do Isolamento de Conversas por Instância no RoyZapp

## Problema Identificado

A conversa da **Amanda Amaral** (telefone: `+557399164182`) está aparecendo para o **Everton Pieri** quando ele acessa o setor de Vendas, mesmo que essa conversa pertença à instância "Whatsapp Jota" do **Jonathan Marcato**.

### Causa Raiz

O filtro por `integration_id` no hook `useZappData.tsx` **só é aplicado quando `integrationId` é explicitamente passado como parâmetro**:

```typescript
if (integrationId) {
  // Aplica filtro - caso contrário, retorna TODAS as conversas do setor
}
```

Quando o `integrationId` não é passado (ou é `undefined`), **todas as conversas do departamento são exibidas**, independentemente de qual instância WhatsApp elas pertencem. Isso viola o princípio de isolamento multi-instância.

### Cenários Problemáticos

1. **Navegação direta** para `/roy-zapp?sector=vendas` sem `integrationId` na URL
2. **Refresh da página** quando o `integrationId` não está persistido na URL
3. **Fallback sem integrações** no hook `useSidebarZappNavigation` (linha 74-77)
4. **Usuários Admin** podem ver todas as conversas se acessarem sem instância específica

---

## Solução Proposta

### 1. Garantir que `integrationId` seja SEMPRE passado

Modificar a lógica para que, quando um setor tem múltiplas instâncias e nenhuma preferência do usuário está salva, o sistema:
- Force a seleção de uma instância antes de exibir conversas
- Ou aplique o fallback para a primeira instância conectada

**Arquivo:** `src/pages/RoyZapp.tsx`

**Mudança:** Quando o `selectedSectorId` está definido mas `selectedIntegrationId` é `undefined`, buscar automaticamente a instância preferida do usuário ou mostrar o seletor de instância.

### 2. Aplicar filtro por `integration_id` como regra obrigatória

**Arquivo:** `src/hooks/useZappData.tsx`

**Mudança:** Quando houver múltiplas instâncias no setor e `integrationId` não for especificado, retornar array vazio e logar um warning. Isso força a seleção explícita de uma instância.

```typescript
// Nova lógica proposta
if (!integrationId) {
  // Verificar se o setor tem múltiplas instâncias
  // Se sim, não exibir conversas até que uma seja selecionada
  console.warn("[ZappData] No integrationId specified - filtering disabled");
  // Pode-se retornar vazio ou aplicar fallback para primeira instância
}
```

### 3. Persistir `integrationId` na URL

**Arquivo:** `src/pages/RoyZapp.tsx`

**Mudança:** Quando o usuário selecionar uma instância via `ZappSectorSelector`, atualizar a URL usando `useSearchParams` para incluir o `integrationId`. Isso garante que:
- Refresh da página mantém a instância selecionada
- Links compartilhados abrem na instância correta

### 4. Buscar preferência do usuário automaticamente

**Arquivo:** `src/pages/RoyZapp.tsx`

**Mudança:** Criar um `useEffect` que, quando `selectedSectorId` está definido mas `selectedIntegrationId` é `undefined`, busque a preferência do usuário na tabela `user_instance_preferences` e aplique automaticamente.

---

## Detalhes Técnicos

### Mudanças no `RoyZapp.tsx`

1. Adicionar `useEffect` para sincronizar preferência de instância:
```typescript
useEffect(() => {
  if (selectedSectorId && !selectedIntegrationId && currentUser?.auth_user_id) {
    // Buscar preferência do usuário
    const fetchPreference = async () => {
      const { data } = await supabase
        .from("user_instance_preferences")
        .select("integration_id")
        .eq("user_id", currentUser.auth_user_id)
        .eq("sector_id", selectedSectorId)
        .maybeSingle();
      
      if (data?.integration_id) {
        setSelectedIntegrationId(data.integration_id);
        // Atualizar URL
        setSearchParams(prev => {
          prev.set('integrationId', data.integration_id);
          return prev;
        });
      }
    };
    fetchPreference();
  }
}, [selectedSectorId, selectedIntegrationId, currentUser?.auth_user_id]);
```

2. Atualizar URL quando instância for selecionada via `ZappSectorSelector`:
```typescript
const [searchParams, setSearchParams] = useSearchParams();

// No callback do ZappSectorSelector:
onSelectSector={(sectorId, integrationId) => {
  setSelectedSectorId(sectorId);
  setSelectedIntegrationId(integrationId);
  // Persistir na URL
  setSearchParams(prev => {
    prev.set('sector', sectorId);
    if (integrationId) prev.set('integrationId', integrationId);
    return prev;
  });
}}
```

### Mudanças no `useZappData.tsx`

1. Adicionar log de warning quando `integrationId` não é especificado em setor com múltiplas instâncias
2. Opcionalmente, forçar retorno vazio se o setor exigir isolamento por instância

---

## Impacto

- **Usuários normais**: Verão apenas conversas da sua instância preferida
- **Admins**: Também respeitarão o filtro por instância (podem trocar manualmente se precisarem ver outra)
- **Grupos**: Continuarão visíveis cross-instância (comportamento intencional)
- **Conversas legacy**: Continuarão visíveis para o setor original

## Arquivos a Modificar

1. `src/pages/RoyZapp.tsx` - Auto-seleção de instância e persistência na URL
2. `src/hooks/useZappData.tsx` - Enforcement do filtro por integração (warning/fallback)

