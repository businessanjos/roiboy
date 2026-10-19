# Revisão complementar mobile — madrugada 2026-10-19

Rodada finita de estados menos exercitados, na prévia (localhost:8080) com sessão de QA autenticada (não em produção). Gravações bloqueadas por guarda de rotas (REST POST/PUT/PATCH/DELETE e functions retornam 200/[]; RPCs de leitura liberadas). Nenhuma mensagem, ligação, fila ou registro foi alterada — 84 escritas bloqueadas por largura, incluindo `check_force_relogin` e chamadas do discador 3C.

## Cobertura (320x740, 393x500, 440x852)

1. **RoyZapp Vendas** (`/roy-zapp?view=team&sector=vendas`): inbox, menu Seções, gesto lateral, view Equipe — ok após correção (ver achados).
2. **Pipeline**: filtros expandidos/recolhidos, gesto — ok após correção do painel de filtros.
3. **Leads**: lista, gesto, drawer de lead existente — ok (o aviso "Erro ao carregar negociações: Failed to fetch" é efeito da guarda de escrita do QA, não defeito).
4. **CS Clientes**: lista, busca, gesto — ok.
5. **Finanças**: dashboard, `/financial/entries`, gesto, dialog "Incluir Conta a Receber" aberto/fechado sem salvar — ok. (A rota `/financial/lancamentos` não existe — 404; a correta é `/financial/entries`.)
6. **Marketing**: Content HQ e calendário, gesto — ok.
7. **RH**: dashboard e colaboradores, gesto — ok.
8. **Eventos** e **Configurações** (menu especializado via Mais) — ok.

Medição antes e depois do gesto lateral em cada estado: `document.scrollWidth`, `main clientWidth/scrollWidth/scrollLeft`, `window.scrollX` e elementos fora da viewport (com recorte interno de tabelas/kanban respeitado). Imagens inspecionadas visualmente, não só métricas.

## Achados e correções

1. **Painel de filtros do Pipeline vazava 20px em 320px** (`PipelineFilterButton.tsx`): `PopoverContent` com `w-[340px]` fixo. Corrigido para `w-[min(340px,calc(100vw-1rem))]`. Complemento (achado em produção, /pipeline > Filtros > Filtros avançado): em 393x500 o popover (y204..587) ultrapassava a altura de 500px com body travado. Adicionado `max-h-[var(--radix-popover-content-available-height)] overflow-y-auto` no `PopoverContent` (nesse primeiro momento as 4 `ScrollArea` continuaram `h-[280px]`, e o próprio popover rolava; ver complemento das abas). Verificado com fotos: 320x740 popover x16 w304, 393x500 y204 h296, 440x852 x29 w340, desktop 1440 inalterado (340px). Nenhum filtro salvo; apenas abrir/medir/fechar.
2. **Equipe de Atendimento do RoyZapp com selos sobrepostos aos toggles em mobile** (`ZappTeamList.tsx`): a linha avatar+texto+ações não quebrava, esmagando nome/selos sob os switches. Corrigido com `flex-wrap` na linha, `basis-40` no bloco de texto, `flex-wrap` na linha de selos e `ml-auto` nas ações — em telas estreitas os controles descem para uma segunda linha; desktop permanece em uma linha (foto 320/393x500/1440).
3. **Mesma classe de defeito (largura fixa > 320px) em outros popovers/sheet**, corrigidos preventivamente com `min(...,100vw)`:
   - `PayerSelector.tsx` (480px), `ClientRelationships.tsx` (350px), `FailedZappSendsAlert.tsx` (380px), `ZappMediaGallery.tsx` (sheet 380px).

## Falsos positivos descartados

- `ol.fixed` (recipiente de toasts) medido fora da viewport apenas na página 404, sem toast visível — sem impacto real.

## Validação

- Compilação automática: build OK (05:09 e 05:15 UTC).
- Imagens inspecionadas: pipeline-filtro-corrigido (320/393x500), menu Mais (320), drawer de lead (320), dialog financeiro (320), equipe RoyZapp antes/depois (320/393x500/1440).

## Limites

- Emulação Chromium, não iPhone físico.
- Não abri conversa individual do RoyZapp nesta rodada (o clique caiu na view Equipe); composer com foco não reexercitado — coberto na rodada anterior.
- Dialogs foram apenas abertos/fechados; nenhum salvamento testado (proibido).
- Não refeita a varredura das 139 rotas nem a matriz completa anterior.

## Pendências

Nenhuma pendente neste escopo. Aguardando revisão do usuário para publicação.

## Complemento: diálogo Novo Evento em 320px (achado em produção)

- **Causa:** o `DialogContent` de `/events` (inline em `src/pages/Events.tsx`) é `grid gap-4` sem template de coluna; a coluna assumia o min-content do filho mais largo (input `datetime-local`, ~279px), esticando todos os campos e criando ~30px de rolagem horizontal interna. As grades `grid-cols-2` (Tipo/Modalidade, Data/Hora, múltiplos dias) agravavam o corte.
- **Correção:** `grid-cols-1` no `DialogContent` (minmax(0,1fr) limita a coluna à largura do diálogo) e `grid-cols-1 sm:grid-cols-2` nas três grades do formulário em `Events.tsx`. Mesmo ajuste aplicado aos componentes compartilhados `EventQuickFormDialog.tsx` e `EventEditDialog.tsx` (3 grades cada).
- **Verificação (prévia, QA autenticado, gravações bloqueadas):** 320x740 — diálogo 294/294 (antes 294/327), todos os campos visíveis sem corte, rolagem vertical até Criar/Cancelar (fotos topo e rodapé inspecionadas); 393x500 — 367/367. Nenhum clique em Criar/salvar. Build automático OK (05:30 UTC).

## Complemento: RoyZapp mobile reabrindo conversa antiga

- Causa: o efeito mobile reaplicava `state.zappSelection`/`zappList` a cada atualização de `assignments`, sobrescrevendo conversa aberta por notificação/URL.
- Correção: estado de histórico aplicado uma única vez por entrada (`src/lib/navigation/zappMobileSelection.ts`); notificação no mobile agora cria entrada de histórico (lista → conversa) como a lista. Bloqueio de outro atendente, setor/instância, leitura e backend inalterados.
- Testes: `zappMobileSelection.test.ts` cobre lista→A→notificação B→atualização mantém B; lista após Voltar→notificação B mantém B; Voltar/Avançar; espera do carregamento. Sem mensagens reais, notificações reais ou registros criados.

## Complemento: botão "Visibilidade em outros setores" (Novo Evento)

- Antes (320): botão width 246, client 244 / scroll 258; seta saía ~13px da borda.
- Correção em `src/pages/Events.tsx` e `src/components/marketing/MarketingEventSheet.tsx`: texto pode quebrar (altura automática), bloco interno `min-w-0 flex-1`, ícones/badge `shrink-0`. Texto completo preservado.
- Depois: 320x740 client 244 / scroll 244, conteúdo até x266 (borda 283), fechado e aberto; 393x500 317/317. Gravações bloqueadas, nada salvo.

## Complemento: coluna dos diálogos compartilhados de evento

- `EventQuickFormDialog.tsx` e `EventEditDialog.tsx`: `DialogContent` recebeu `grid-cols-1` (além das grades internas já empilhadas).
- Verificado em 320x740 (`/events/calendar` > Novo evento, gravações bloqueadas, nada salvo): diálogo x12..308, client 294 / scroll 294, topo e rodapé. Edição usa a mesma classe; não aberta para não tocar evento real.

## Complemento: abas dos Filtros avançados do Pipeline

- Causa: `TabsList grid-cols-4` em 304px não comportava os rótulos; "Recomendados" invadia "Personalizados".
- Correção (`PipelineFilterButton.tsx`): abaixo de `sm` as abas formam grade 2x2 (altura automática, cada aba com min-h 40px); a partir de `sm`, quatro colunas como antes. Filtros e regras inalterados.
- 320x740: abas x17..168 / 168..319 em duas linhas, todos os rótulos inteiros, sem sobreposição. 393x500: popover rola até a última opção (Vanessa Minelli) visível. 440: 2x2 sem corte. Gravações bloqueadas, nada salvo.

- Correção posterior (revisão do commit 944ac96e): as 4 `ScrollArea` agora usam `h-[min(280px,calc(var(--radix-popover-content-available-height)-144px))]` no celular (busca + abas 2x2) e `-104px` a partir de `sm` (abas em uma linha). Assim só a lista rola, e não o popover junto.
- Medição: 393x500, popover client 294 / scroll 294 (sem rolagem própria), lista y347..499 com 152px visíveis e 428 de conteúdo; rolada até o fim mostra a última opção (Vanessa Minelli) inteira. 320x740 e 440x852: lista com 280px, igual a antes. Gravações bloqueadas, nada salvo.
