

## Corrigir flickering dos visuais ao trocar de painel

### Causa raiz
Quando o usuario troca de painel e volta, o componente `InsightsGrid` remonta. Na montagem, o `react-grid-layout` dispara `onLayoutChange` automaticamente, o que chama `handleContinuousLayoutChange` e atualiza o `localLayout`. Se o layout calculado pela biblioteca diferir minimamente do layout salvo no banco, o componente re-renderiza, disparando outro `onLayoutChange`, criando um ciclo de oscilacao (flickering).

### Solucao
Ignorar o evento `onLayoutChange` que dispara automaticamente na montagem do componente. Somente processar eventos de layout durante interacoes reais (drag/resize).

### Mudanca tecnica

**`src/components/insights/grid/InsightsGrid.tsx`**
- Adicionar um `useRef` booleano (`isMountedRef`) que inicia como `false`
- No primeiro `onLayoutChange` (disparado automaticamente na montagem), ignorar a chamada e marcar o ref como `true`
- Somente sincronizar o `localLayout` em chamadas subsequentes (durante drag/resize reais)
- Resetar o ref quando os IDs dos visuais mudam (nova montagem logica)

```text
const isMountedRef = useRef(false);

// Reset on visual changes
useEffect(() => {
  isMountedRef.current = false;
}, [visual IDs]);

// In handleContinuousLayoutChange:
if (!isMountedRef.current) {
  isMountedRef.current = true;
  return; // skip initial mount event
}
// ... rest of sync logic
```

### Resultado
Os visuais manterao suas posicoes estaveis ao trocar entre paineis, sem flicker.

