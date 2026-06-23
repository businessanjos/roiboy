## Problema

Quando você clica em **Equipe** (ou Departamentos, Tags, Configurações, Playbook) na sidebar do ROY zAPP **sem ter um setor selecionado**, a URL muda para `/roy-zapp?view=team` mas a tela continua mostrando o seletor de setor — porque o `RoyZapp.tsx` força o `ZappSectorSelector` sempre que `selectedSectorId` está vazio, ignorando o `view` da URL.

Por isso "nada acontece": o clique navega, mas o seletor de setor permanece renderizado por cima.

## Solução

Em `src/pages/RoyZapp.tsx`, antes do bloco que renderiza o `ZappSectorSelector` (linha ~1130), liberar a renderização do layout normal para as views administrativas que **não dependem de um setor**: `team`, `departments`, `tags`, `settings`, `playbook`.

- Se `selectedSectorId` for nulo **e** `activeView` for uma dessas views administrativas → renderizar o painel normal (ZappConversationPanel + área de conteúdo) com `sectorId = null`. O `ZappTeamList` já funciona sem setor (usa `account_id` do `useZappData`).
- Se `activeView` for `inbox`, `meetings` ou `sector` → manter o comportamento atual (mostrar seletor de setor).
- O lado direito (chat) fica em estado vazio, já que o foco é o painel administrativo da esquerda.

## Detalhes técnicos

Arquivo único: `src/pages/RoyZapp.tsx`

```ts
const SECTORLESS_VIEWS = new Set<ZappView>([
  "team", "departments", "tags", "settings", "playbook"
]);

if (!selectedSectorId && !SECTORLESS_VIEWS.has(activeView) && activeView !== "whatsapp-admin") {
  return <ZappSectorSelector ... />;
}
```

Nenhuma alteração em hooks, RLS ou outros componentes — `useZappData({ sectorId: undefined })` já é suportado e retorna agents/teamUsers do account inteiro, que é exatamente o que o `ZappTeamList` precisa para listar (e adicionar) a Camila.

## Resultado

Clicar em **Equipe** abre direto a lista de atendentes, onde você pode usar o botão **Adicionar** para cadastrar a Camila como `zapp_agent`, sem precisar selecionar um setor primeiro.