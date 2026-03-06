

## Diagnóstico: Solicitações de Acesso não Aparecem no ROY

### Problemas Identificados

**1. Cleanup agressivo de 30 minutos (Causa principal)**
Tanto o handler POST (linha 2147-2153) quanto o GET (linha 2337-2342) da Edge Function deletam requests `pending` e `rejected` com mais de 30 minutos. Se o admin não abrir o modal dentro desse período, a solicitação desaparece sem rastro — e o visitante fica preso na tela "Aguardando Aprovação" para sempre.

**2. Modal sem atualização automática**
O `ShareDashboardModal` só busca requests ao abrir (`useEffect` no `open`). Não há polling nem realtime — se uma nova solicitação chegar enquanto o modal está aberto, ela não aparece.

**3. Notificação funciona, mas não abre o modal**
O link da notificação (`/insights/${dashboard_id}?tab=shares`) leva à página de insights, mas não há lógica para abrir o modal de compartilhamento automaticamente ao chegar nessa rota.

### Plano de Correção

**A. Edge Function (`shared-dashboard/index.ts`)**
- Remover a limpeza automática de requests `pending` — requests pendentes devem persistir indefinidamente até que o admin as aprove/rejeite
- Manter limpeza apenas de requests `rejected` com mais de 30 minutos (para permitir re-solicitações)

**B. ShareDashboardModal (`ShareDashboardModal.tsx`)**
- Adicionar polling de 15 segundos para buscar novas solicitações enquanto o modal estiver aberto
- Isso garante que requests que chegam enquanto o modal está aberto sejam exibidas

**C. Notificação com badge na sidebar (Feedback visual)**
- Na sidebar do Insights ou no botão de compartilhar, adicionar um indicador visual (badge/dot) quando houver requests pendentes para o dashboard ativo, para que o admin saiba que precisa agir sem precisar abrir o modal manualmente

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts` — remover cleanup de `pending` requests
- `src/components/insights/ShareDashboardModal.tsx` — adicionar polling de requests

