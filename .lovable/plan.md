

# Plano: Mostrar Grupos em Comum na Busca de Contatos do ROY zAPP

## Resumo do Objetivo

Quando o usuário buscar um contato no diálogo "Nova Conversa" do ROY zAPP, além de mostrar o contato encontrado, o sistema também deve exibir os grupos WhatsApp que esse contato participa em comum com a instância conectada.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DA FEATURE                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. USUARIO DIGITA NOME/TELEFONE                                               │
│     └─> searchContacts() busca clientes, leads, conversas                      │
│                                                                                 │
│  2. AO ENCONTRAR CONTATOS                                                       │
│     └─> Para cada telefone encontrado, buscar grupos em comum                  │
│     └─> Consulta whatsapp_group_participants por phone                         │
│                                                                                 │
│  3. RESULTADO AGRUPADO                                                          │
│     ├─> Contato: "João Silva" [Cliente]                                        │
│     │   └─> Grupos em comum: "QG Anjos", "Leadership Team"                     │
│     └─> Contato: "Maria Santos" [Lead]                                         │
│         └─> Grupos em comum: "ClaxClub Sócios"                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Alteracoes Necessarias

### Parte 1: Criar Tabela de Cache de Participantes (SQL Migration)

Criar tabela `whatsapp_group_participants` para armazenar participantes de cada grupo:

```sql
CREATE TABLE public.whatsapp_group_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  phone text NOT NULL,
  name text,
  is_admin boolean DEFAULT false,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, group_jid, phone)
);

CREATE INDEX idx_group_participants_account ON whatsapp_group_participants(account_id);
CREATE INDEX idx_group_participants_phone ON whatsapp_group_participants(account_id, phone);
CREATE INDEX idx_group_participants_group ON whatsapp_group_participants(account_id, group_jid);

-- Habilitar RLS
ALTER TABLE whatsapp_group_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_account_participants" ON whatsapp_group_participants
  FOR SELECT USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "service_role_all" ON whatsapp_group_participants
  FOR ALL USING (true) WITH CHECK (true);
```

### Parte 2: Atualizar uazapi-manager para Salvar Participantes

Modificar a action `group_participants` ou criar uma nova action `sync_group_participants` que alem de retornar os participantes, salva no banco de dados.

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

Adicionar logica para inserir participantes na tabela apos buscar da API:

```typescript
// Apos obter participants com sucesso
if (participants.length > 0) {
  // Limpar participantes antigos deste grupo
  await supabaseClient
    .from("whatsapp_group_participants")
    .delete()
    .eq("account_id", accountId)
    .eq("group_jid", groupJidForParticipants);
  
  // Inserir novos participantes
  const participantRows = participants.map(p => ({
    account_id: accountId,
    group_jid: groupJidForParticipants,
    phone: p.phone,
    name: p.name || null,
    is_admin: p.admin === "admin" || p.admin === "superadmin",
    synced_at: new Date().toISOString(),
  }));
  
  await supabaseClient
    .from("whatsapp_group_participants")
    .insert(participantRows);
}
```

### Parte 3: Criar Sincronizacao Inicial de Todos os Grupos

Adicionar nova action `sync_all_group_participants` no uazapi-manager que:
1. Lista todos os grupos da conta
2. Para cada grupo, busca participantes
3. Salva todos no banco

Isso pode ser disparado manualmente ou via cron.

### Parte 4: Modificar searchContacts no RoyZapp.tsx

**Arquivo:** `src/pages/RoyZapp.tsx`

Apos encontrar contatos, buscar grupos em comum para cada telefone:

```typescript
// Apos obter combined de contatos
const phonesForGroupSearch = combined.map(c => c.phone_e164?.replace(/\D/g, '')).filter(Boolean);

// Buscar grupos em comum para esses telefones
const { data: groupParticipants } = await supabase
  .from("whatsapp_group_participants")
  .select("phone, group_jid, whatsapp_groups(name, avatar_url)")
  .eq("account_id", currentUser.account_id)
  .in("phone", phonesForGroupSearch);

// Criar mapa de telefone -> grupos
const phoneToGroups = new Map<string, Array<{name: string, avatar_url: string | null}>>();
(groupParticipants || []).forEach(p => {
  const phone = p.phone;
  if (!phoneToGroups.has(phone)) {
    phoneToGroups.set(phone, []);
  }
  if (p.whatsapp_groups) {
    phoneToGroups.get(phone)!.push({
      name: p.whatsapp_groups.name,
      avatar_url: p.whatsapp_groups.avatar_url,
    });
  }
});

// Adicionar grupos aos contatos
const combinedWithGroups = combined.map(c => ({
  ...c,
  common_groups: phoneToGroups.get(c.phone_e164?.replace(/\D/g, '') || '') || [],
}));

setNewConversationClients(combinedWithGroups);
```

### Parte 5: Atualizar Interface Contact

**Arquivo:** `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx`

Atualizar interface Contact para incluir grupos:

```typescript
interface Contact {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
  type?: 'client' | 'lead' | 'conversation';
  common_groups?: Array<{ name: string; avatar_url: string | null }>;
}
```

### Parte 6: Exibir Grupos em Comum no UI

**Arquivo:** `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx`

Adicionar exibicao de grupos abaixo de cada contato:

```tsx
<button key={...} onClick={...} className="...">
  {/* Avatar e info existentes */}
  <Avatar>...</Avatar>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span>{formatName(client.full_name)}</span>
      <Badge>...</Badge>
    </div>
    <p className="text-[#8696a0] text-sm truncate">{client.phone_e164}</p>
    
    {/* NOVO: Grupos em comum */}
    {client.common_groups && client.common_groups.length > 0 && (
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <Users className="h-3 w-3 text-[#8696a0]" />
        <span className="text-xs text-[#8696a0]">
          {client.common_groups.length} grupo{client.common_groups.length > 1 ? 's' : ''} em comum:
        </span>
        {client.common_groups.slice(0, 3).map((g, i) => (
          <Badge key={i} variant="outline" className="text-xs bg-[#202c33] border-[#3b4a54]">
            {g.name.slice(0, 15)}{g.name.length > 15 ? '...' : ''}
          </Badge>
        ))}
        {client.common_groups.length > 3 && (
          <span className="text-xs text-[#8696a0]">+{client.common_groups.length - 3}</span>
        )}
      </div>
    )}
  </div>
</button>
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| SQL Migration | Criar tabela `whatsapp_group_participants` |
| `supabase/functions/uazapi-manager/index.ts` | Salvar participantes ao buscar grupos |
| `src/pages/RoyZapp.tsx` | Modificar `searchContacts` para buscar grupos em comum |
| `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx` | Adicionar interface e UI para grupos em comum |

## Estrategia de Sincronizacao de Participantes

1. **Sincronizacao sob demanda**: Quando `group_participants` e chamado, salvar no banco
2. **Sincronizacao inicial**: Botao na pagina de grupos para sincronizar todos os participantes
3. **Sincronizacao automatica**: Quando uma mensagem de grupo e recebida, atualizar cache do grupo

## Consideracoes de Performance

- A busca de grupos sera feita em paralelo com a busca de contatos
- Limite de 3 grupos exibidos inline com "+N" para excesso
- Cache de participantes evita chamadas repetidas a API UAZAPI
- Indice `idx_group_participants_phone` otimiza busca por telefone

## Layout Visual Final

```text
┌────────────────────────────────────────────────────────────────────┐
│ Nova Conversa                                                   X │
├────────────────────────────────────────────────────────────────────┤
│ Busque um contato para iniciar uma conversa                       │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ Buscar por nome ou telefone...                                 ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ [AV] João Silva              [Cliente]                         ││
│ │      +55 11 98765-4321                                         ││
│ │      👥 2 grupos em comum: [QG Anjos] [Leadership]             ││
│ ├────────────────────────────────────────────────────────────────┤│
│ │ [AV] Maria Santos            [Lead]                            ││
│ │      +55 21 99876-5432                                         ││
│ │      👥 1 grupo em comum: [ClaxClub Socios]                    ││
│ ├────────────────────────────────────────────────────────────────┤│
│ │ [AV] Pedro Alves             [Contato]                         ││
│ │      +55 31 98888-7777                                         ││
│ │      (sem grupos em comum)                                     ││
│ └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

