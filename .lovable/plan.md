

# Plano: API Key para Admins no Perfil

## Visão Geral

Adicionar uma nova aba "API Key" na página de Perfil, visível apenas para usuários com cargo de Admin, permitindo:
- Gerar uma chave de API com permissões de Admin
- Visualização protegida (chave visível apenas uma vez)
- Histórico de execuções
- Excluir ou regenerar a chave

---

## Arquitetura

### 1. Tabela no Banco de Dados

Criar duas tabelas para gerenciar API Keys e seus logs:

```sql
-- Tabela de API Keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'API Key Principal',
  key_hash TEXT NOT NULL,         -- SHA-256 hash da chave
  key_preview TEXT NOT NULL,      -- Ex: "roy_...a1b2" para exibição
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)                 -- Apenas 1 chave por usuário
);

-- Tabela de logs de execução
CREATE TABLE public.api_key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  method TEXT,                    -- GET, POST, PUT, DELETE
  path TEXT,                      -- /api/clients, etc.
  status_code INTEGER,            -- 200, 401, 500, etc.
  ip_address TEXT,
  user_agent TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
ON api_keys FOR ALL USING (user_id IN (
  SELECT id FROM users WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can view logs of their own keys"
ON api_key_logs FOR SELECT USING (
  api_key_id IN (
    SELECT id FROM api_keys WHERE user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

-- Índices para performance
CREATE INDEX idx_api_key_logs_key_id ON api_key_logs(api_key_id);
CREATE INDEX idx_api_key_logs_executed_at ON api_key_logs(executed_at DESC);
```

### 2. Estrutura de Componentes

```text
src/
├── pages/Profile.tsx              (modificar - adicionar aba)
├── components/profile/
│   ├── ApiKeyTab.tsx              (novo - conteúdo da aba)
│   └── ApiKeyHistoryTable.tsx     (novo - tabela de histórico)
```

---

## Fluxo de Segurança

### Geração da Chave

```text
1. Usuário Admin clica "Gerar Nova Chave"
   ↓
2. Frontend gera chave aleatória: "roy_" + 32 caracteres
   Ex: "roy_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
   ↓
3. Calcula SHA-256 hash da chave
   ↓
4. Salva no banco:
   - key_hash: hash SHA-256
   - key_preview: "roy_sk_...n4o5" (primeiros 6 + últimos 4)
   ↓
5. Exibe chave COMPLETA uma única vez com aviso:
   "Copie agora! Esta chave não será exibida novamente."
   ↓
6. Se existir chave anterior, ela é automaticamente revogada
```

### Validação da Chave (Edge Functions)

```text
1. Request chega com header: Authorization: Bearer roy_sk_...
   ↓
2. Edge Function calcula SHA-256 do token
   ↓
3. Busca na tabela api_keys por key_hash
   ↓
4. Se encontrado e is_active = true:
   - Atualiza last_used_at
   - Insere log em api_key_logs
   - Retorna user_id e account_id para a função
   ↓
5. Se não encontrado: retorna 401 Unauthorized
```

---

## Alterações nos Arquivos

### Arquivo 1: `src/pages/Profile.tsx`

**Modificações:**
1. Adicionar import do componente `ApiKeyTab`
2. Adicionar import do hook `usePermissions`
3. Adicionar import do ícone `Key`
4. Adicionar aba condicional para Admins

```typescript
// Novos imports
import { usePermissions } from "@/hooks/usePermissions";
import { ApiKeyTab } from "@/components/profile/ApiKeyTab";
import { Key } from "lucide-react";

// Dentro do componente, após outros hooks
const { isAdmin } = usePermissions();

// No TabsList, após "Reuniões" (condicional)
{isAdmin && (
  <TabsTrigger value="api-key" className="gap-2">
    <Key className="h-4 w-4" />
    API Key
  </TabsTrigger>
)}

// Novo TabsContent antes do fechamento de </Tabs>
{isAdmin && (
  <TabsContent value="api-key">
    <ApiKeyTab userId={profile.id} accountId={profile.account_id} />
  </TabsContent>
)}
```

### Arquivo 2: `src/components/profile/ApiKeyTab.tsx` (novo)

Componente principal com:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 🔐 Chave de API                                                        │
│ Use esta chave para autenticar integrações externas                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🔑 Sua Chave Atual                                                 │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │                                                                    │ │
│ │ Preview:  roy_sk_...n4o5         Criada em: 06/02/2026 14:30       │ │
│ │                                  Último uso: 06/02/2026 15:45     │ │
│ │                                                                    │ │
│ │ ⚠️ A chave completa foi exibida apenas no momento da criação.      │ │
│ │                                                                    │ │
│ │     [🔄 Gerar Nova Chave]      [🗑️ Revogar Chave]                   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 📋 Histórico de Execuções                                          │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Data/Hora      │ Método │ Endpoint        │ Status │ IP           │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ 06/02 15:45    │ POST   │ /api/clients    │ 201    │ 189.x.x.x    │ │
│ │ 06/02 15:30    │ GET    │ /api/events     │ 200    │ 189.x.x.x    │ │
│ │ 06/02 14:15    │ PUT    │ /api/clients/x  │ 200    │ 189.x.x.x    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Verifica se existe chave ativa
- Exibe preview da chave (nunca a chave completa)
- Botão "Gerar Nova Chave" com diálogo de confirmação
- Botão "Revogar Chave" com confirmação
- Quando gera nova chave: dialog modal com chave completa + botão copiar
- Lista histórico de execuções paginado

### Arquivo 3: `src/components/profile/ApiKeyHistoryTable.tsx` (novo)

Tabela de histórico com:
- Data/Hora formatada
- Badge colorido por método (GET=azul, POST=verde, DELETE=vermelho)
- Endpoint truncado
- Status code com cor (2xx=verde, 4xx=amarelo, 5xx=vermelho)
- IP address
- Paginação (20 por página)

---

## Layout do Dialog de Chave Gerada

```text
┌──────────────────────────────────────────────────────────────┐
│ ✅ Chave Gerada com Sucesso!                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️  ATENÇÃO: Copie sua chave agora!                         │
│                                                              │
│  Esta chave só será exibida UMA VEZ. Após fechar este       │
│  dialog, você não poderá visualizá-la novamente.            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ roy_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9        │  │
│  │                                          [📋 Copiar]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Como usar:                                                  │
│  Authorization: Bearer <sua-chave>                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                        [Entendi e Copiei]    │
└──────────────────────────────────────────────────────────────┘
```

---

## Resumo das Modificações

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas `api_keys` e `api_key_logs` com RLS |
| `src/pages/Profile.tsx` | Adicionar aba "API Key" condicional para Admins |
| `src/components/profile/ApiKeyTab.tsx` | Novo - gerenciamento da API Key |
| `src/components/profile/ApiKeyHistoryTable.tsx` | Novo - tabela de histórico |

---

## Notas Técnicas

### Formato da Chave

```
roy_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
└──┘└─┘└─────────────────────────────┘
 │   │            │
 │   │            └── 32 caracteres aleatórios (a-z, 0-9)
 │   └── Prefixo "sk_" (secret key)
 └── Prefixo "roy_" (identificação do sistema)
```

### Geração Segura

```typescript
// Gerar chave no frontend
const generateApiKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomPart = Array.from(
    crypto.getRandomValues(new Uint8Array(32))
  ).map(n => chars[n % chars.length]).join('');
  return `roy_sk_${randomPart}`;
};

// Hash SHA-256
const hashKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
```

### Constraint de Unicidade

A constraint `UNIQUE(user_id)` garante que cada usuário tenha apenas uma chave ativa. Ao gerar uma nova, a anterior é automaticamente substituída.

