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

1. **Painel de filtros do Pipeline vazava 20px em 320px** (`PipelineFilterButton.tsx`): `PopoverContent` com `w-[340px]` fixo. Corrigido para `w-[min(340px,calc(100vw-1rem))]`. Verificado com foto em 320 e 393x500.
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
