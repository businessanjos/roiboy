

# Correção: Ocultar Barra de Trial no Modo Foco/Tela Cheia

## Problema Identificado

O `TrialBanner` está sendo renderizado no `AppLayout` (linha 56) como um elemento irmão do container onde os dashboards são exibidos. Mesmo com `z-[9999]`, o overlay do Modo Foco não consegue cobrir o banner porque:

1. **No Modo Foco**: O overlay é renderizado dentro do dashboard, que é um descendente profundo na árvore DOM. O z-index funciona relativamente ao contexto de empilhamento.
2. **Na Tela Cheia**: O `requestFullscreen()` é aplicado ao `document.documentElement`, colocando TODA a página em fullscreen, incluindo o banner.

## Solução

Utilizar **React Portal** para renderizar o overlay do Modo Foco diretamente no `body`, garantindo que ele fique acima de todos os elementos da aplicação.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/marketing/SocialMediaDashboard.tsx` | Envolver overlay com Portal |
| `src/components/marketing/TikTokDashboard.tsx` | Envolver overlay com Portal |

---

## Implementação Técnica

### Importar createPortal do React DOM
```typescript
import { createPortal } from "react-dom";
```

### Envolver o overlay com Portal
```tsx
// Antes
{isFocusMode && (
  <div className="fixed inset-0 z-[9999] bg-background overflow-auto">
    ...
  </div>
)}

// Depois
{isFocusMode && createPortal(
  <div className="fixed inset-0 z-[9999] bg-background overflow-auto">
    ...
  </div>,
  document.body
)}
```

### Aplicar Fullscreen no container do overlay (não no documento)
```typescript
// Criar ref para o container do modo foco
const focusModeRef = useRef<HTMLDivElement>(null);

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    // Aplicar fullscreen no container do modo foco, não no documento
    await focusModeRef.current?.requestFullscreen();
  } else if (document.exitFullscreen) {
    await document.exitFullscreen();
  }
};

// Na renderização
{isFocusMode && createPortal(
  <div 
    ref={focusModeRef}
    className="fixed inset-0 z-[9999] bg-background overflow-auto"
  >
    ...
  </div>,
  document.body
)}
```

---

## Resultado Esperado

1. **Modo Foco**: O overlay será renderizado como filho direto do `body`, ficando acima do `TrialBanner`
2. **Tela Cheia**: Apenas o conteúdo do overlay entrará em fullscreen, não a página inteira
3. **Barra de Trial**: Completamente oculta em ambos os modos
4. **Funcionalidade mantida**: ESC, botão fechar, filtro de período - tudo continua funcionando

