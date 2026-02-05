
# Otimização do Layout do Modo Foco para TV

## Problema Identificado
Atualmente, o layout do Modo Foco/Tela Cheia possui:
- Conteúdo alinhado ao topo com muito espaço em branco embaixo
- Cards de KPI pequenos para uma tela de TV grande
- Container limitado que não aproveita bem a tela

## Solução Proposta

### 1. Centralização Vertical e Horizontal
Usar Flexbox para centralizar todo o conteúdo na viewport, eliminando o espaço em branco excessivo.

### 2. Zoom nos KPIs
Aumentar o tamanho dos cards de KPI para melhor visualização em TV:
- Ícones maiores (de `h-6 w-6` para `h-8 w-8`)
- Padding ampliado nos cards
- Fonte dos valores maior (de `text-3xl` para `text-4xl`)

### 3. Layout Responsivo para Tela Cheia
- Container com largura máxima maior (`max-w-[90vw]`)
- Centralização vertical usando `min-h-full flex flex-col justify-center`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `SocialMediaDashboard.tsx` | Centralizar conteúdo, ampliar KPIs |
| `TikTokDashboard.tsx` | Mesmas alterações |

---

## Mudanças Específicas

### Container Principal
```tsx
// Antes
<div className="container mx-auto py-8 px-6 max-w-7xl">

// Depois
<div className="min-h-full flex flex-col justify-center px-8 py-6 mx-auto max-w-[95vw]">
```

### Cards de KPI
```tsx
// Antes
<CardContent className="p-6">
  <div className="flex items-center gap-4">
    <div className="p-3 rounded-lg bg-primary/10">
      <Users className="h-6 w-6 text-primary" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Total Seguidores</p>
      <p className="text-3xl font-bold">{formatNumber(totals.totalFollowers)}</p>
    </div>
  </div>
</CardContent>

// Depois
<CardContent className="p-8">
  <div className="flex items-center gap-5">
    <div className="p-4 rounded-xl bg-primary/10">
      <Users className="h-8 w-8 text-primary" />
    </div>
    <div>
      <p className="text-base text-muted-foreground">Total Seguidores</p>
      <p className="text-4xl font-bold">{formatNumber(totals.totalFollowers)}</p>
    </div>
  </div>
</CardContent>
```

### Grid dos KPIs
```tsx
// Antes
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

// Depois
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
```

---

## Resultado Visual Esperado

```
┌────────────────────────────────────────────────────────────────────────┐
│                                              [Período ▾] [⛶] [X]       │
│                                                                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────┐│
│  │ 👥              │ │ 📊              │ │ 📝              │ │ 📈        ││
│  │ Total           │ │ Engaj.          │ │ Total           │ │ Perfis   ││
│  │ Seguidores      │ │ Médio           │ │ Posts           │ │ Ativos   ││
│  │ 286.7K          │ │ 5.6%            │ │ 4.9K            │ │ 6        ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └──────────┘│
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Métricas por Perfil                                                ││
│  ├────────────────────────────────────────────────────────────────────┤│
│  │ @evertonpieri_ │ 144.2K │ 215 │ 1.8K │ 7.7%  │ 2.5K │ 61 │ 1      ││
│  │ @abrunapieri   │ 102.9K │ 161 │ 1.5K │ 25.1% │ 917  │ 43 │ 0      ││
│  │ ...                                                                ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Centralização**: Conteúdo posicionado no centro da tela, eliminando espaço em branco desnecessário
2. **Zoom Visual**: KPIs maiores e mais legíveis para visualização à distância
3. **Aproveitamento de Tela**: Container usa 95% da viewport width
4. **Hierarquia Visual**: Títulos e valores com fontes ampliadas
