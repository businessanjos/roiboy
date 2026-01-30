
# Plano: Corrigir Conversa Invisível na Barra Lateral do ROY zAPP

## Diagnóstico

### O Que Está Acontecendo
A conversa "Henrique & Leticia - Eternum Club" está visível no painel de chat (lado direito) com status "Em atendimento", mas não aparece na lista lateral de conversas.

### Causa Raiz Identificada
A conversa possui assignments apenas para os setores **Operações** e **Diretoria**:

| Departamento | Setor | Status | Agente |
|--------------|-------|--------|--------|
| Operações | operacoes | active | Atribuído |
| Diretoria | diretoria | triage | Sem agente |

Porém, o usuário está no setor **"ROY zAPP"** (sector_id: `royzapp`). Como não existe assignment desta conversa para o departamento "ROY zAPP", ela não aparece na lista filtrada.

### Como a Conversa Foi Aberta?
A conversa pode ter sido selecionada via:
1. URL com parâmetro `?conversation=xxx`
2. Notificação de nova mensagem
3. Estado herdado de sessão anterior em outro setor

O problema é que não há lógica que **limpe a conversa selecionada** quando ela não pertence ao setor atual.

---

## Solução

Implementar uma validação que verifica se a conversa selecionada pertence ao setor atual. Se não pertencer, oferecer opção de criar um assignment local ou limpar a seleção.

### Abordagem Escolhida
Adicionar um `useEffect` que detecta quando a conversa selecionada não está na lista de assignments do setor atual e apresenta um aviso com opções ao usuário.

---

## Alterações Técnicas

### Arquivo: `src/pages/RoyZapp.tsx`

#### 1. Adicionar Validação de Conversa Órfã (novo useEffect)

Após a linha ~170 (onde está o useEffect de sincronização), adicionar:

```typescript
// Detect when selected conversation doesn't belong to current sector
useEffect(() => {
  if (!selectedConversation || !selectedSectorId || assignments.length === 0) return;
  
  // Check if the selected conversation exists in current sector's assignments
  const existsInCurrentSector = assignments.some(
    a => a.id === selectedConversation.id
  );
  
  if (!existsInCurrentSector) {
    // Conversation is from another sector - clear selection
    console.log("[RoyZapp] Selected conversation not in current sector, clearing selection");
    setSelectedConversation(null);
    toast.info("A conversa aberta pertence a outro setor e foi fechada");
  }
}, [selectedConversation, assignments, selectedSectorId]);
```

#### 2. Alternativa: Oferecer Opção de Puxar Conversa

Se preferirmos que o usuário possa "puxar" a conversa para o setor atual, podemos:

1. Detectar a conversa órfã
2. Mostrar um diálogo perguntando se quer criar um assignment no setor atual
3. Se sim, criar novo assignment para o departamento atual

```typescript
// State for orphan conversation dialog
const [orphanConversation, setOrphanConversation] = useState<ConversationAssignment | null>(null);

// Detect orphan
useEffect(() => {
  if (!selectedConversation || !selectedSectorId || assignments.length === 0) return;
  
  const existsInCurrentSector = assignments.some(a => a.id === selectedConversation.id);
  
  if (!existsInCurrentSector && !orphanConversation) {
    setOrphanConversation(selectedConversation);
  }
}, [selectedConversation, assignments, selectedSectorId]);

// Handle pulling orphan conversation to current sector
const pullOrphanToCurrentSector = async () => {
  if (!orphanConversation || !currentSectorDepartmentId || !currentUser?.account_id) return;
  
  const zappConvId = orphanConversation.zapp_conversation_id || orphanConversation.zapp_conversation?.id;
  if (!zappConvId) return;
  
  // Create new assignment for current sector
  const { data, error } = await supabase
    .from("zapp_conversation_assignments")
    .insert({
      account_id: currentUser.account_id,
      zapp_conversation_id: zappConvId,
      agent_id: currentAgent?.id || null,
      department_id: currentSectorDepartmentId,
      status: currentAgent ? "active" : "triage",
    })
    .select()
    .single();
  
  if (!error && data) {
    setAssignments(prev => [data, ...prev]);
    setSelectedConversation(data);
    toast.success("Conversa puxada para este setor!");
  }
  
  setOrphanConversation(null);
};

const dismissOrphan = () => {
  setSelectedConversation(null);
  setOrphanConversation(null);
};
```

---

## Recomendação

A **solução simples** (Alternativa 1 - limpar automaticamente) é mais segura porque:
1. Evita duplicação de assignments entre setores
2. Mantém isolamento rigoroso de conversas por setor
3. É consistente com a memória `roy-zapp-sector-isolation-fix-v2-pt`

Se o usuário precisar atender essa conversa no setor "ROY zAPP", ele deve:
1. Acessar o setor correto (Operações ou Diretoria)
2. Ou transferir a conversa para o departamento ROY zAPP usando a função de transferência

---

## Fluxo Após Correção

```
Usuário abre conversa de outro setor
            │
            ▼
useEffect detecta que conversa não está em assignments
            │
            ▼
Limpa selectedConversation e mostra toast
            │
            ▼
Painel de chat fica vazio, lista mostra conversas corretas
```

---

## Arquivos a Modificar

1. **src/pages/RoyZapp.tsx** - Adicionar useEffect de validação (~5 linhas)

## Impacto

- Correção imediata do bug visual
- Prevenção de confusão do usuário ao ver conversa que não pode gerenciar
- Mantém consistência do isolamento por setor
