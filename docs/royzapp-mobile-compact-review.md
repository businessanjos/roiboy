# RoyZapp: revisão visual mobile

## Resultado na prévia

Alterações exclusivamente de apresentação; não foram alterados banco, regras de acesso, conexões, read-state ou callbacks de negócio. Nada publicado.

### Problemas corrigidos

- Cabeçalho empilhava identidade e ícones em 120px; no celular agora tem 64px, voltar, nome do setor legível, nova conversa e menu de ações secundárias.
- Navegação ocupava 109px em 393px e 157px no CS em 320px; agora 45px com seção atual e tipo de conversa na mesma faixa.
- `all` não tinha representação no Comercial após tocar Minhas/Fila; agora o seletor mostra **Todas**, sem alterar o reset existente.
- Busca competia com escopo e Puxar; escopo de atendentes e Puxar continuam disponíveis dentro do filtro, com os mesmos critérios e callbacks. A seleção de atendentes é compartilhada entre desktop/mobile para evitar duplicar critérios.
- Dois wrappers vazios reservavam 16px para alertas ausentes; margem agora pertence aos próprios alertas e só existe quando renderizados.
- Cabeçalho da conversa ocupava 113px antes; agora 61px mobile. Ações secundárias e status estão no menu rotulado; voltar e contatos de grupo continuam acessíveis.
- Atalhos do composer agora têm 44px e componentes padrão; placeholder curto evita quebra em 320px, botões de emoji/envio têm nomes acessíveis.
- Troca de linha preservada via seletor existente quando há múltiplas; não reserva faixa quando só há uma.

## Medições reais

Sem safe-area física; sessão autenticada de Everton na prévia localhost, não em produção.

| Tela | Largura × altura | Lista antes (y) | Lista depois (y) | Header depois | Navegação depois | Busca depois |
|---|---|---:|---:|---:|---:|---:|
| Vendas | 320 × 740 | 342 | 210 | 64 | 45 | 56 |
| CS | 320 × 740 | 390 | 210 | 64 | 45 | 56 |
| Vendas | 393 × 852 | 342 | 210 | 64 | 45 | 56 |
| CS | 393 × 852 | 342 | 210 | 64 | 45 | 56 |
| Vendas | 440 × 956 | 342 | 210 | 64 | 45 | 56 |
| CS | 440 × 956 | 342 | 210 | 64 | 45 | 56 |

Minhas/Fila: 44px + borda = 45px. Recuperação de 132px em 393px e 180px no CS em 320px.
A medida da lista é da região rolável; CS mantém seus grupos fixados no início, não remove conteúdo para atingir a meta.
Desktop 1440 × 1800 inspecionado com inbox e chat dos dois setores; sem overflow horizontal. Desktop preserva organização existente.

## Caminhos realmente percorridos

- `/roy-zapp?sector=vendas` e `/roy-zapp?sector=operacoes` em 320/393/440/1440: inbox, Fila, conversa existente.
- Nas três larguras mobile: conversa → voltar → lista; nome do setor íntegro, nomes longos na conversa em até duas linhas.
- Em 393: Minhas → filtros → escopo de atendentes → opções; Puxar visível, **não acionado**.
- Em 393: menu de ações, menu de seções permitido e seleção de setor nos dois setores.
- CS: seções → Configurações → voltar → inbox, mantendo `sector` e `integrationId`.
- Vendas não tem Configurações na lista permitida existente; não foi acrescentada nem burlada.
- Menus das conversas inspecionados; nenhum status, transferência, ligação ou exclusão acionado.
- Composer em 393 × 480: textarea y=420, fundo=472, viewport=480, dentro da tela; sem digitar nem enviar.

Screenshots antes/depois de inbox e conversa foram capturados e inspecionados, incluindo filtros, escopo, seções, ações, Configurações, seleção e composer reduzido. Arquivos temporários em `/tmp/browser/zapp-compact`; a primeira captura de menus pegou animação parcial e foi descartada, recapturada após estabilização.

## Verificações

- `bunx vitest run src/lib/navigation src/lib/__tests__/royZappRoutes.test.ts src/lib/__tests__/royZappAccess.test.ts src/hooks/useVisualViewportHeight.test.ts`: **8 arquivos, 33 testes passaram**.
- Build/typecheck automático: último estado **build OK**. Não executado build/typecheck manual, conforme restrição do ambiente.
- Playwright autenticado: nenhum erro JavaScript; nenhuma largura testada apresentou overflow de viewport.
- Interceptação de gravações: bloqueou PATCH de conversas/read-state e agentes, além de funções não reconhecidas como leitura, sugestões e discador; acesso real de leitura manteve listas/mensagens. Nenhuma ação de negócio foi executada.

## Arquivos alterados

- `src/components/royzapp/ZappConversationPanel.tsx`
- `src/components/royzapp/ZappSidebarNav.tsx`
- `src/components/royzapp/ZappChatHeader.tsx`
- `src/components/royzapp/ZappMessageInput.tsx`
- `src/components/royzapp/ZappInstanceSwitcher.tsx`
- `src/components/royzapp/ZappRoleHelpPopover.tsx`
- `AGENTS.md`, `roadmap.md` e este relatório.

## Limitações

- Teclado e safe-area em iPhone físico não testados: viewport reduzida é simulação, não comprova teclado real.
- Múltiplas conexões e alertas reais não disponíveis na sessão exercitada; controles mantidos, sem operação de conexão.
- Funções bloqueadas por segurança podem mostrar seleção de setores como desconectada ou Configurações sem conexões; isso não é diagnóstico da conexão real.
- Discador ativo/sugestões não verificados operacionalmente; guard bloqueou funções que poderiam produzir efeitos. Código de telefonia não alterado.
- Não testado todos os cargos nem envios, puxar fila, status, contatos, conexões ou ações financeiras.
- Demais pendências históricas no roadmap estão fora desta revisão e não foram alteradas.
