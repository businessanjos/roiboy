
# Calendário de Conteúdo - Nova Aba do Marketing

## Visão Geral

Criar uma nova aba no setor de Marketing chamada "Calendário de Conteúdo" que exibirá um calendário mensal com ícones das plataformas (Instagram e TikTok) indicando os posts publicados em cada data, com navegação direta para a análise do conteúdo na aba Social Media.

---

## Arquivos a Criar

### 1. Nova Página: `src/pages/ContentCalendar.tsx`

Página principal do Calendário de Conteúdo contendo:
- Cabeçalho com título e navegação de mês
- Grid mensal similar ao calendário anual existente
- Sem botão "Novo Evento" (foco em visualização)
- Exibição de ícones de plataforma com contadores

### 2. Componente de Visualização: `src/components/marketing/ContentCalendarView.tsx`

Componente do calendário mensal adaptado que:
- Busca posts do Instagram e TikTok por data
- Agrupa posts por plataforma e data
- Exibe ícones clicáveis com badge de contagem
- Usa cores oficiais das plataformas (gradiente Instagram, preto TikTok)

### 3. Diálogo de Lista: `src/components/marketing/ContentCalendarPostsDialog.tsx`

Modal que aparece ao clicar em uma plataforma com múltiplos posts:
- Lista os títulos/legendas dos posts daquela data
- Cada item é clicável e redireciona para `/social-media` com o post selecionado

### 4. Hook de Dados: `src/hooks/useContentCalendarData.tsx`

Hook que:
- Busca posts do Instagram e TikTok para o mês selecionado
- Agrupa por data e plataforma
- Retorna estrutura otimizada para o calendário

---

## Arquivos a Modificar

### 1. `src/config/sectors.ts`

Adicionar nova entrada no navItems do Marketing:

```typescript
navItems: [
  { to: "/marketing", icon: CalendarDays, label: "Calendário Anual" },
  { to: "/content-calendar", icon: LayoutGrid, label: "Conteúdo" }, // Nome curto para caber
  { to: "/social-media", icon: Instagram, label: "Social Media" },
  { to: "/marketing-tasks", icon: ClipboardList, label: "Tarefas" },
  { to: "/notifications", icon: Bell, label: "Notificações" },
]
```

O label "Conteúdo" (ou "Cal. Conteúdo") garante que caiba no menu lateral sem modificar seu tamanho.

### 2. `src/App.tsx`

Adicionar nova rota:

```typescript
const ContentCalendar = lazy(() => import("./pages/ContentCalendar"));
// ...
<Route path="/content-calendar" element={<ContentCalendar />} />
```

---

## Design Visual dos Ícones no Calendário

Cada célula do dia exibirá:

```text
┌─────────────────┐
│  5              │  ← Número do dia
│                 │
│  📸 2  🎵 1    │  ← Ícones com badges (estilo notificação)
│                 │
└─────────────────┘
```

### Estilo dos Ícones

**Instagram**:
- Ícone com gradiente característico (rosa/laranja/roxo)
- Badge pequeno vermelho com número no canto superior direito

**TikTok**:
- Ícone preto com detalhes em ciano/rosa (cores oficiais)
- Badge pequeno vermelho com número no canto superior direito

### Comportamento ao Clicar

| Cenário | Ação |
|---------|------|
| 1 post na plataforma | Redireciona direto para `/social-media` com a plataforma e post selecionados |
| 2+ posts na plataforma | Abre diálogo com lista de posts; ao clicar em um, redireciona |

---

## Fluxo de Navegação

```text
┌─────────────────────────────────────────────────────────────┐
│                   CALENDÁRIO DE CONTEÚDO                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Usuário clica no ícone Instagram (1 post)                 │
│  └──▶ Navega para /social-media?platform=instagram          │
│       └──▶ Abre aba Instagram com o post em destaque        │
│                                                             │
│  Usuário clica no ícone TikTok (3 posts)                   │
│  └──▶ Abre diálogo com lista dos 3 posts                   │
│       └──▶ Usuário clica em um post específico             │
│            └──▶ Navega para /social-media?platform=tiktok   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Dados

### Tipo para Posts Agrupados

```typescript
interface ContentByDate {
  [dateKey: string]: {
    instagram: {
      count: number;
      posts: Array<{
        id: string;
        caption: string | null;
        thumbnail_url: string | null;
        posted_at: string;
      }>;
    };
    tiktok: {
      count: number;
      posts: Array<{
        id: string;
        caption: string | null;
        thumbnail_url: string | null;
        posted_at: string;
      }>;
    };
  };
}
```

---

## Detalhes Técnicos

### Query para Buscar Posts

O hook buscará posts de ambas as tabelas em paralelo:

```typescript
// Instagram
const { data: igPosts } = await supabase
  .from('instagram_posts')
  .select('id, caption, thumbnail_url, posted_at, profile_id')
  .gte('posted_at', startOfMonth)
  .lte('posted_at', endOfMonth);

// TikTok  
const { data: tkPosts } = await supabase
  .from('tiktok_posts')
  .select('id, caption, thumbnail_url, posted_at, profile_id')
  .gte('posted_at', startOfMonth)
  .lte('posted_at', endOfMonth);
```

### Cores Oficiais das Plataformas

**Instagram** (gradiente):
- Background: `linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)`

**TikTok**:
- Preto principal: `#000000`
- Ciano: `#00f2ea`
- Rosa: `#ff0050`

---

## Resumo dos Arquivos

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/pages/ContentCalendar.tsx` | Página principal |
| Criar | `src/components/marketing/ContentCalendarView.tsx` | Grid do calendário |
| Criar | `src/components/marketing/ContentCalendarPostsDialog.tsx` | Diálogo de lista |
| Criar | `src/hooks/useContentCalendarData.tsx` | Hook de dados |
| Modificar | `src/config/sectors.ts` | Adicionar item no menu |
| Modificar | `src/App.tsx` | Adicionar rota |

---

## Resultado Esperado

- Nova aba "Conteúdo" visível no menu lateral do Marketing
- Calendário mensal mostrando ícones de Instagram/TikTok nos dias com publicações
- Badges com contagem sutil (estilo notificação)
- Navegação intuitiva para a análise de cada post
- Visualização rápida da distribuição de conteúdo ao longo do mês
