
# Plano: Permitir Grupos em Múltiplos Setores Simultaneamente

## Situação Atual

Quando você abre uma conversa de grupo que pertence a outro setor (como "Operações"), o sistema fecha a conversa e mostra a mensagem "A conversa aberta pertence a outro setor". Isso é restritivo demais para grupos.

## Objetivo

Permitir que grupos sejam atendidos em múltiplos setores ao mesmo tempo. Cada setor terá seu próprio assignment (ticket) para o mesmo grupo.

---

## Alterações Técnicas

### Arquivo: `src/pages/RoyZapp.tsx`

#### 1. Substituir Validação "Órfã" por Lógica de Multi-Setor

Substituir o `useEffect` atual (linhas 171-186) que limpa a conversa por uma lógica inteligente que:

1. Detecta quando a conversa selecionada não está nos assignments do setor atual
2. Verifica se é um **grupo** (somente grupos podem estar em múltiplos setores)
3. Se for grupo: **cria automaticamente um novo assignment** no setor atual
4. Se for contato individual: mantém o comportamento de limpar (evita duplicação de tickets)

```typescript
// Detect when selected conversation doesn't belong to current sector
useEffect(() => {
  if (!selectedConversation || !selectedSectorId || !currentUser?.account_id) return;
  if (!currentSectorDepartmentId) return;
  
  // Check if the selected conversation exists in current sector's assignments
  const existsInCurrentSector = assignments.some(
    a => a.id === selectedConversation.id
  );
  
  if (existsInCurrentSector) return; // Already in this sector, nothing to do
  
  // Check if it's a group conversation
  const isGroup = selectedConversation.zapp_conversation?.is_group;
  const zappConvId = selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id;
  
  if (!zappConvId) {
    setSelectedConversation(null);
    return;
  }
  
  if (isGroup) {
    // GROUPS: Auto-create assignment in current sector (multi-sector support)
    const createAssignmentForCurrentSector = async () => {
      // First check if an assignment already exists for this conversation in this department
      const { data: existingAssignment } = await supabase
        .from("zapp_conversation_assignments")
        .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
        .eq("zapp_conversation_id", zappConvId)
        .eq("department_id", currentSectorDepartmentId)
        .neq("status", "closed")
        .maybeSingle();
      
      if (existingAssignment) {
        // Assignment exists but wasn't in our assignments list (refresh issue)
        setSelectedConversation(existingAssignment);
        setAssignments(prev => {
          const exists = prev.some(a => a.id === existingAssignment.id);
          return exists ? prev : [existingAssignment, ...prev];
        });
        return;
      }
      
      // Create new assignment for this sector
      const { data: newAssignment, error } = await supabase
        .from("zapp_conversation_assignments")
        .insert({
          account_id: currentUser.account_id,
          zapp_conversation_id: zappConvId,
          agent_id: currentAgent?.id || null,
          status: currentAgent ? "active" : "triage",
          department_id: currentSectorDepartmentId,
          assigned_at: currentAgent ? new Date().toISOString() : null,
        })
        .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
        .single();
      
      if (error) {
        console.error("[RoyZapp] Failed to create multi-sector assignment:", error);
        toast.error("Erro ao abrir grupo neste setor");
        setSelectedConversation(null);
        return;
      }
      
      if (newAssignment) {
        const enrichedAssignment = {
          ...newAssignment,
          agent: currentAgent || null
        };
        setSelectedConversation(enrichedAssignment);
        setAssignments(prev => [enrichedAssignment, ...prev]);
        toast.success("Grupo aberto neste setor!");
      }
    };
    
    createAssignmentForCurrentSector();
  } else {
    // INDIVIDUAL CONTACTS: Clear selection (must be handled by original sector)
    console.log("[RoyZapp] Individual conversation from another sector, clearing selection");
    setSelectedConversation(null);
    toast.info("Conversa individual pertence a outro setor");
  }
}, [selectedConversation, assignments, selectedSectorId, currentSectorDepartmentId, currentUser?.account_id, currentAgent]);
```

---

## Fluxo de Dados

```text
Usuário abre grupo de outro setor (ex: via URL)
                    │
                    ▼
     useEffect detecta conversa "órfã"
                    │
                    ▼
         É um grupo? ─── Não ──► Limpa seleção
                │                 (comportamento atual)
               Sim
                │
                ▼
    Verifica se já tem assignment
    no department atual
                │
                ├── Sim ──► Usa o existente
                │
                └── Não ──► Cria novo assignment
                            │
                            ▼
                     Adiciona à lista local
                            │
                            ▼
                     Grupo aparece na sidebar
                     E está em atendimento!
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Grupo fechava ao trocar de setor | Grupo abre automaticamente no novo setor |
| Precisava criar assignment manualmente | Assignment criado automaticamente |
| Apenas 1 setor podia atender o grupo | Múltiplos setores atendem simultaneamente |
| Perdia contexto ao trocar de setor | Cada setor mantém seu próprio ticket |

---

## Casos de Uso

1. **Grupo de cliente VIP**: Atendido por Operações e Diretoria ao mesmo tempo
2. **Grupo de leads**: Vendas e Marketing acompanham simultaneamente  
3. **Grupo de projeto**: Operações e Financeiro coordenam juntos

---

## Considerações de Segurança

- Contatos individuais continuam isolados por setor (não duplica tickets)
- Cada setor tem seu próprio status de atendimento (triage, active, closed)
- Histórico de mensagens é compartilhado (é o mesmo grupo no WhatsApp)
- Cada setor pode ter agente diferente atribuído

---

## Arquivo a Modificar

1. **src/pages/RoyZapp.tsx** - Substituir useEffect de validação órfã (~40 linhas)
