
# Correção do Modo Foco + Botão Tela Cheia

## Problemas Identificados

1. **Overlay não cobre tudo**: O `z-50` não é suficiente para cobrir a barra superior com o botão "Ver planos"
2. **Falta opção de tela cheia real**: Usuário quer transmitir via Chromecast e precisa da Fullscreen API do navegador

---

## Soluções

### 1. Aumentar z-index do overlay
Mudar de `z-50` para `z-[9999]` para garantir que o overlay fique acima de todos os elementos do aplicativo.

### 2. Adicionar botão de Tela Cheia (Fullscreen API)
Implementar um botão que ativa o modo fullscreen real do navegador, ideal para transmissão via Chromecast.

---

## Implementação

### Novo Ícone
- Importar `Fullscreen` do lucide-react (ícone de 4 setas apontando para fora)

### Novo Estado
```typescript
const [isFullscreen, setIsFullscreen] = useState(false);
```

### Funções de Fullscreen
```typescript
const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    setIsFullscreen(true);
  } else {
    await document.exitFullscreen();
    setIsFullscreen(false);
  }
};

// Listener para detectar saída do fullscreen
useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
}, []);
```

### Novo Layout do Header no Modo Foco
```
┌─────────────────────────────────────────────────────────────────┐
│  Visão Consolidada        [Período ▾] [⛶ Tela Cheia] [X Fechar] │
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `SocialMediaDashboard.tsx` | z-index, estado fullscreen, botão tela cheia |
| `TikTokDashboard.tsx` | Mesmas alterações |

---

## Mudanças Específicas

### z-index do overlay
```tsx
// Antes
<div className="fixed inset-0 z-50 bg-background overflow-auto">

// Depois  
<div className="fixed inset-0 z-[9999] bg-background overflow-auto">
```

### Novo header com botões
```tsx
<div className="flex justify-end mb-6 gap-2">
  <Button
    variant="outline"
    size="icon"
    onClick={toggleFullscreen}
    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
  >
    <Fullscreen className="h-5 w-5" />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setIsFocusMode(false)}
  >
    <X className="h-5 w-5" />
  </Button>
</div>
```

---

## Resultado Esperado

1. **Overlay completo**: Nenhum elemento do app aparece por cima do modo foco
2. **Tela cheia real**: Botão ativa fullscreen do navegador para transmissão perfeita via Chromecast
3. **Controles visíveis**: Filtro de período, botão fullscreen e botão fechar disponíveis
4. **Tecla ESC**: Funciona para sair tanto do modo foco quanto do fullscreen
