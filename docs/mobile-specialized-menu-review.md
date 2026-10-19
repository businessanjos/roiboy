# Revisão direcionada — d1116f6

## Correção
- O Mais voltou a reutilizar `SettingsSidebarNav`, `AdminSidebarNav` e `ClientDetailSidebarNav`, exatamente como no desktop, sem copiar condições de permissão.
- Configurações, Administração e ficha exibem Mais mesmo sem setor salvo. Nessas telas não há atalhos de outro setor; as opções específicas ficam no Mais.
- Títulos do Mais: Configurações, Administração e Ficha do cliente.
- Busca aplicada aos grupos já permitidos nos próprios menus especializados; controles de navegação com altura mínima de 44px e `aria-current`.
- Setores comuns continuam com `MobileSectorMenu` pesquisável. Nenhum acesso removido. Nenhuma alteração de backend, permissões ou dados de negócio. Nada publicado.

## Arquivos
- `src/components/layout/MobileTabBar.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/SettingsSidebarNav.tsx`
- `src/components/layout/AdminSidebarNav.tsx`
- `src/components/layout/ClientDetailSidebarNav.tsx`
- `src/lib/navigation/specializedMenu.ts`
- `src/lib/navigation/specializedMenu.test.ts`
- `AGENTS.md`, `roadmap.md`, este relatório.

## Verificações efetivamente executadas
Comando:
```sh
bunx vitest run src/lib/navigation/{specializedMenu,clientRoutes,mobileNavigation,activeNav,zappSectionNavigation}.test.ts src/lib/access/routeAccess.test.ts src/lib/__tests__/royZappRoutes.test.ts src/hooks/useVisualViewportHeight.test.ts
```
Resultado: 8 arquivos, 53 testes aprovados.

Browser autenticado como o solicitante, Chromium, 393 × 852:
- `/settings` diretamente com `current_sector` removido: Mais visível, Equipe e Integrações presentes.
- Meu Perfil → busca por Equipe → Equipe → voltar do navegador: retorna ao perfil e fecha o menu.
- Áreas → botão de configurações/perfil → Configurações: Mais disponível.
- Ficha real de cliente → Contratos → voltar; ficha → Financeiro → voltar: abas e histórico corretos, sem executar ações de negócio.
- `/admin` com usuário autorizado: conteúdo de Administração carregado, menu completo, Status → voltar.
- Rodada anterior: RoyZapp CS Configurações → inbox preserva conexão; menu rotulado → Equipe → inbox; seletor com cartões acessíveis e sem botões aninhados; abrir CS; Mais de Vendas com Pipeline atual e Gestão sem `aria-current`.
- Nenhuma exceção JavaScript nos dois scripts. Capturas inspecionadas para Configurações, Administração e Financeiro.

Comandos dos scripts:
```sh
python3 /tmp/browser/specialized-menu/check_paths.py
python3 /tmp/browser/mobile-complement/check_context.py
```

O browser bloqueou PATCH/PUT/DELETE e gravações REST POST fora de RPC. Apenas navegação/leitura foi exercitada; nenhuma mensagem enviada, ligação feita ou ação financeira executada.

Compilação automática: `tail -8 /tmp/observability/build-errors.log`, último registro `2026-10-19T00:28:04Z`: `build OK`.

## Limitações
- Build e typecheck explícitos **não executados**: as instruções do ambiente proíbem rodá-los manualmente e reservam a compilação ao verificador automático. Não há resultado de typecheck separado a reportar.
- Sem iPhone físico; teclado/momentum não verificados.
- Esta rodada testou somente os trajetos solicitados e os da rodada anterior, não a matriz completa nem outros cargos.
- Pendências antigas do roadmap não fazem parte desta regressão e não foram alteradas.