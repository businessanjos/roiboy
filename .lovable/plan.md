
# Modo Foco para Dashboard Social Media

## Objetivo
Adicionar um botão de **Modo Foco** ao dashboard de Social Media que exibe o conteúdo em tela cheia, ideal para transmissão via Chromecast em TVs.

---

## O que será implementado

### Comportamento do Modo Foco
1. **Botão de Ativação**: Ícone de expansão (Maximize2) ao lado do filtro de período
2. **Tela Cheia Limpa**: Remove toda a interface do aplicativo (sidebar, header, tabs) e exibe apenas:
   - Os 4 cards de KPI (Total Seguidores, Engaj. Médio, Total Posts, Perfis Ativos)
   - A tabela de Métricas por Perfil
3. **Controles de Saída**:
   - Botão de fechar no canto superior direito
   - Tecla `ESC` para sair
4. **Visual Otimizado para TV**: 
   - Fundo sólido escuro/claro (respeitando o tema)
   - Conteúdo centralizado com espaçamento adequado
   - Filtro de período visível para ajustes

---

## Design Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                                                          [X]    │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ Total       │ │ Engaj.      │ │ Total       │ │ Perfis     ││
│  │ Seguidores  │ │ Médio       │ │ Posts       │ │ Ativos     ││
│  │ 286.7K      │ │ 5.6%        │ │ 4.9K        │ │ 6          ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Métricas por Perfil                    [Período: 3 meses ▾] ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Perfil          │ Seguidores │ Posts │ Engaj. │ ...        ││
│  │ @evertonpieri_  │ 144.2K     │ 1.8K  │ 7.7%   │            ││
│  │ @abrunapieri    │ 102.9K     │ 1.5K  │ 25.1%  │            ││
│  │ ...             │            │       │        │            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/marketing/SocialMediaDashboard.tsx` | Adicionar estado e overlay do modo foco para Instagram |
| `src/components/marketing/TikTokDashboard.tsx` | Adicionar estado e overlay do modo foco para TikTok |

---

## Implementação Técnica

### Novo Estado
```typescript
const [isFocusMode, setIsFocusMode] = useState(false);
```

### Botão de Ativação
Adicionado ao lado do filtro de período:
```tsx
<Button
  variant="outline"
  size="icon"
  onClick={() => setIsFocusMode(true)}
  title="Modo Foco (ideal para TV)"
>
  <Maximize2 className="h-4 w-4" />
</Button>
```

### Overlay Fullscreen
```tsx
{isFocusMode && (
  <div className="fixed inset-0 z-50 bg-background overflow-auto">
    <div className="container mx-auto py-8 px-6">
      {/* Botão fechar */}
      {/* KPI Cards */}
      {/* Tabela de Perfis */}
    </div>
  </div>
)}
```

### Listener de ESC
```typescript
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFocusMode) {
      setIsFocusMode(false);
    }
  };
  document.addEventListener('keydown', handleEsc);
  return () => document.removeEventListener('keydown', handleEsc);
}, [isFocusMode]);
```

---

## Resultado Esperado

1. **Instagram Dashboard**: Botão de expansão visível, clique ativa modo foco
2. **TikTok Dashboard**: Mesmo comportamento
3. **Transmissão Chromecast**: Interface limpa sem distrações, apenas dados relevantes
4. **Fácil saída**: ESC ou botão X retornam à visualização normal
