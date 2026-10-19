# Auditoria de largura mobile — deslocamento lateral ("app desencaixado")

Base: HEAD `ca9818ca9`. Ambiente: prévia local autenticada (sessão injetada do usuário Everton Pieri), Chromium headless com `isMobile`/`hasTouch`.
Nada publicado. Nenhuma alteração de backend, dados, permissões, regras ou integrações.

## 1. Diagnóstico (antes)

Para cada rota e largura: `document.scrollWidth` × `clientWidth`, `#app-main-scroll.scrollWidth` × `clientWidth`,
`scrollLeft` de todos os ancestrais do main, retângulos de elementos visíveis fora da viewport (excluindo os que estão dentro
de região própria com `overflow-x` limitada à tela), gesto lateral real (`Input.synthesizeScrollGesture` touch + roda horizontal)
e, quando não havia elemento culpado visível, eliminação (esconder filho a filho até o `scrollWidth` cair).

Resultado antes: o **documento nunca ficou mais largo** que a viewport (html/body/#root corretos). O deslocamento vinha
do **main** (`overflow-auto` nos dois eixos): o conteúdo ficava mais largo que ele e o arrasto lateral rolava a tela inteira.

| Largura | Rotas com main mais largo que a tela | Pior caso |
|---|---|---|
| 320 | 39 | /admin/whatsapp-diagnostics 851px; /reminders 698px; /marketing-insights 607px |
| 393 | 16 | idem |
| 440 | 11 | idem |

O gesto lateral confirmou: `main.scrollLeft` ia até 400px (ex.: diagnóstico WhatsApp), com `window.scrollX = 0`.

## 2. Causas exatas

1. **Shell (causa sistêmica).** `main` é `flex flex-col`. Raízes de página com `max-w-* mx-auto` (padrão de RH, Admin,
   Marketing, Clínica Ryka…) têm margens automáticas, o que desliga o `stretch`: viram `fit-content` e crescem até o
   min-content do conteúdo (ex.: `/rh/departments` raiz com 501px em 320). Uma única linha sem quebra alargava a página toda.
   Além disso o main rolava na horizontal.
2. **Linhas de título + ações sem quebra** (`flex items-center justify-between` sem `flex-wrap`) e grupos de botões
   `whitespace-nowrap`: Configurações da Conta, Orçamento, Comissões, Fornecedores, Calendário anual, Clínica Ryka, Bônus,
   Onboarding, RH (Departamentos, Cargos, Perfis, Desligamentos, Cartas-Proposta, ficha de colaborador/prestador/sócio),
   Agências e comparativo, Diagnóstico WhatsApp, Ajuda financeira, gráfico de investimento.
3. **Larguras fixas**: busca `w-[280px]` (Clínica Ryka), `w-64` (Organograma), `w-44` (Ajuda), seletor `w-[240px]` (Redes),
   coluna de painéis `w-56` lado a lado (Insights de Marketing), `min-w-[200px]` no "Salvo às" dos perfis de RH.
4. **Textos sem quebra**: e-mails longos (perfil em Configurações, Fornecedores, Prestadores, Bônus) e valores em reais
   `text-2xl` dentro de cartões de 103px (Aging — só detectável por eliminação, pois o texto não é elemento).
5. **Passo a passo de Lembretes**: 5 rótulos + `mx-4` em linha única (698px).

## 3. Correções

- `src/components/layout/AppLayout.tsx`: abaixo de `lg` o main rola só na vertical (`overflow-y-auto overflow-x-hidden`;
  desktop mantém `overflow-x-auto`). RoyZapp inalterado (já `overflow-hidden` com scrollers próprios).
- `src/index.css` (bloco mobile): `:where(#app-main-scroll) > * { width:100%; min-width:0 }` — a raiz de cada tela ocupa
  exatamente a largura do main; especificidade zero, então utilitários de largura explícitos continuam vencendo.
  Isso **não é a única defesa**: todas as causas do item 2–5 foram corrigidas na origem; a auditoria mede o
  `scrollWidth` do main (que continua revelando overflow mesmo com o eixo x travado), logo nada fica escondido sem ser medido.
- Telas (quebra de linha, `min-w-0`, larguras fluidas só no celular, `break-all` em e-mails, valores menores no celular):
  `AccountSettings`, `DailyContentPanel`, `EventsCalendar`, `FinancialBalanceSheetPage`, `FinancialBudgetPage`,
  `BudgetManager`, `FinancialAgingPage`, `CommissionDashboard`, `FinancialActiveClientsPage`, `FinancialProfitabilityPage`,
  `FinancialSuppliersPage`, `FinancialFaqPage`, `MarketingInsightsTab`, `MarketingAgencies`, `MarketingAgenciesCompare`,
  `AdSpendTrendCharts`, `SocialMediaTab`, `ClinicaRyka`, `ConsultantBonus`, `Reminders` (rótulos só do passo atual no
  celular), `OnboardingOrchestrated`, `ProfileContent`, `WhatsAppDiagnostics`, `RHBehaviorProfiles`, `RHDepartments`,
  `RHPositions`, `RHOffboarding`, `RHOffers`, `OrgChart`, `HRCollaboratorProfile`, `HRServiceProviderProfile`,
  `HRPartnerProfile`, `HRServiceProviders`.
- `MobileAppHeader`: título com `lang="pt-BR"` + `hyphens-auto` (no iOS quebra "Departa-mentos" com hífen em vez de "Departamento / s").
- Mantidos: tabelas, abas e kanban continuam rolando **dentro** das próprias regiões; correções anteriores de navegação,
  compactação do RoyZapp, discador no cabeçalho, scrollers de chat/kanban e leitura individual intactos.

## 4. Verificação (depois)

### Varredura de rotas (139 rotas = todas as internas de App.tsx sem parâmetro + 5 detalhes com registros existentes + RoyZapp Vendas/CS + abas da ficha + Equipe)

| Largura | Rotas | Falhas | main.scrollWidth > clientWidth | scrollX após gesto | Elementos fora da tela |
|---|---|---|---|---|---|
| 320×852 | 139 | 0 | 0 | 0 | 0 |
| 393×852 | 139 | 0 | 0 | 0 | 0 |
| 440×852 | 139 | 0 | 0 | 0 | 0 |
| 1440×900 | 139 | 0 | 0 | 0 | 0 |

32 rotas são apelidos que redirecionam para a tela consolidada (ex.: `/financial/aging → /financial/relatorios?tab=aging`,
`/team → /settings`); foram medidas no destino. Nenhuma redirecionou para Áreas por falta de acesso.

### Interações (320×740, 393×852, 393×500 reduzida, 440×956) — 0 falhas
Áreas → Pipeline → Mais aberto/fechado → kanban rolado internamente (main permaneceu em 0) → Clientes → foco na busca
(fonte 16px, `visualViewport.scale = 1`) → ficha → Mais (menu da ficha) → Contratos → voltar do navegador → menu do perfil →
busca global → Tarefas "Nova tarefa" aberto/fechado → Calendário anual "Novo evento" aberto/fechado → Lançamentos "Novo"
aberto/fechado → RH colaboradores → Calendário de conteúdo → Configurações + Mais → Admin → RoyZapp Vendas (Seções, Filtros,
Ações) → Fila → conversa já existente → Opções da conversa → foco no campo (16px) → voltar → RoyZapp CS + Seções.
Após cada passo: gesto lateral; `scrollX`, `visualViewport.offsetLeft` e `scrollLeft` dos ancestrais sempre 0.
Em 440 o gesto sintético longo abriu o menu de toque longo de um evento no Calendário anual, cobrindo "Novo evento" nesse passo
(nenhuma ação clicada); os demais passos passaram.

### Imagens inspecionadas
Antes/depois em 320 (Departamentos, Pessoas, Lembretes, Insights de Marketing, Comissões, ficha de colaborador): botões que
saíam à direita (Novo Departamento, Excluir/Salvar, Calcular Mês Atual, Adicionar Visual) agora aparecem inteiros em nova linha;
passos de Lembretes cabem. Desktop 1440 (Insights de Marketing, Departamentos, ficha de colaborador) com o layout original.
Pipeline, conversa, menus, Mais de Configurações e "Nova tarefa" em 320 conferidos.

### Testes
- `src/lib/navigation/mobileWidthAudit.test.ts` (novo): o inventário cobre **toda** rota autenticada de App.tsx ou a exclui
  com motivo (falha se surgir rota nova); critérios de violação (main mais largo, documento mais largo, deslocamento após gesto,
  elemento fora da tela, tolerância de 1px).
- `npx vitest run src/lib/navigation`: 6 arquivos, 25 testes, todos passaram.
- Compilação automática: OK. Build/typecheck manuais não executados (vedados neste ambiente).
- Regressão de geometria reexecutável: `scripts/qa/mobile-width-audit.mjs` (+ `mobile-width-measure.js`), somente leitura.

### Segurança dos testes
Todas as gravações foram interceptadas e respondidas localmente (71 por varredura; inclui o salvamento automático da ficha do
colaborador e marcações de leitura). Nenhuma mensagem, ligação, fila, status, cadastro ou configuração alterada.

## 5. Limitações
- Sem iPhone/Safari físico: inércia, teclado real e hifenização do título só foram simulados (Chromium; viewport 500px de altura
  como teclado aberto). No Chromium Linux o título "Departamentos" ainda quebra sem hífen em 320.
- Rotas excluídas (sem registro para abrir sem criar, ou tela cheia de TV): ver `MOBILE_WIDTH_AUDIT_EXCLUDED`.
- Telas medidas com os dados deste usuário (Admin). Estados com mais itens, outras permissões, diálogos não abertos
  (ex.: edições que exigem salvar) e passos internos de assistentes não foram exercitados.
- `/marketing/market-intelligence` registrou erro de console `total_clients_sampled` porque a função de backend foi bloqueada
  pela proteção de testes (resposta vazia); não é efeito destas mudanças, mas indica que a tela não tolera resposta vazia.
- Truncamentos intencionais (etiquetas do cartão do funil, nomes longos) permanecem; não são overflow.
