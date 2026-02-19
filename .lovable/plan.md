

## Corrigir botao de copiar link no modal de Compartilhamento

### Problema

O `navigator.clipboard.writeText()` pode falhar silenciosamente em alguns contextos (iframe, modal com foco no overlay, contextos nao-HTTPS). A funcao `copyLink` nao trata erros e nao tem fallback.

### Solucao

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. **Adicionar fallback para clipboard** na funcao `copyLink` (linhas 127-134):
   - Envolver `navigator.clipboard.writeText()` em try/catch
   - Adicionar fallback usando `document.execCommand('copy')` com um textarea temporario
   - Adicionar `e.stopPropagation()` no onClick do botao para evitar que o clique propague para o Dialog e interfira

2. **Atualizar o onClick do botao copiar** (linha 186):
   - Adicionar `e.stopPropagation()` para prevenir propagacao de evento

### Detalhes tecnicos

Funcao `copyLink` atualizada:
```typescript
const copyLink = async () => {
  if (!shareToken) return;
  const url = `${window.location.origin}/shared/insights/${shareToken}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Fallback for contexts where clipboard API fails
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
  toast.success("Link copiado!");
};
```

Botao atualizado:
```tsx
<Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); copyLink(); }} className="shrink-0">
```

