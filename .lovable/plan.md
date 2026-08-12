# Consolidação do Marketing: de 11 para 6 itens

## Objetivo

Reduzir o atrito de navegação do Marketing juntando áreas que hoje competem entre si (Conteúdo, Social Media e a tela órfã de Criação), reaproveitando o mesmo padrão de hub por abas já validado no Financeiro (`?tab=`).

## Estado atual (verificado)

O menu do setor Marketing tem 11 itens de trabalho (fora Notificações): Dashboard, Calendário Anual, Conteúdo, Projetos, Social Media, Tráfego Pago, Agências, Tarefas, Rebranding, Insights, Market Intelligence.

Sobreposições confirmadas:
- `/social-media` já contém 6 abas (Instagram, TikTok, YouTube, Calendário, Métricas manuais, Checklist), cada rede com sub-abas Perfis/Dashboard.
- `/marketing/content-hq` é uma página separada de conteúdo, sem abas próprias.
- `/criacao` já redireciona para o Content HQ, mas a página `ContentCreation.tsx` continua no código com 10 ferramentas de IA (Hoje, Copilot, Persona, Ideias, Editorial, Trends, Hooks, Copy IA, Referências, Tom de Voz) que hoje ninguém consegue abrir pela UI.
- Existem três superfícies de calendário: `/marketing` (calendário anual), a aba Calendário do Social Media e o antigo `/content-calendar` (já redirecionado).

## Menu proposto (6 itens)

```text
1. Dashboard            -> /marketing/dashboard
2. Calendário           -> /marketing            (anual + conteúdo em abas)
3. Conteúdo             -> /marketing/content-hq (hub: Produção, Redes, Criação IA, Checklist, Métricas)
4. Campanhas & Mídia    -> /marketing/trafego-pago (hub: Tráfego Pago, Agências, Links/UTM)
5. Projetos & Tarefas   -> /marketing/projetos   (hub: Projetos, Tarefas, Rebranding)
6. Inteligência         -> /marketing-insights   (hub: Insights, Market Intelligence)
```

Notificações continua fora da contagem, no rodapé do menu como hoje.

## Detalhe de cada hub

### Conteúdo (`/marketing/content-hq`)
Abas:
- **Produção** — conteúdo atual do Content HQ (fluxo de posts/entregáveis).
- **Redes** — abas internas Instagram / TikTok / YouTube vindas do Social Media, preservando as sub-abas Perfis/Dashboard.
- **Criação IA** — resgate do `ContentCreation.tsx` com as 10 ferramentas hoje inacessíveis, agrupadas em sub-abas.
- **Checklist** — `ContentChecklistTab`.
- **Métricas** — `ManualMetricsTab` (Eternum RECORDES), incluindo comparação de perfis.

### Calendário (`/marketing`)
Abas **Anual** (visão atual) e **Conteúdo** (a `ContentCalendarView` que hoje vive no Social Media), com os filtros de camadas já existentes.

### Campanhas & Mídia (`/marketing/trafego-pago`)
Abas **Tráfego Pago**, **Agências** (lista, comparativo e relatórios semanais) e **Links & UTM**.

### Projetos & Tarefas (`/marketing/projetos`)
Abas **Projetos**, **Tarefas** e **Rebranding**.

### Inteligência (`/marketing-insights`)
Abas **Insights** e **Market Intelligence**.

## Compatibilidade de links

Nenhuma URL antiga quebra. Todas as rotas atuais viram `Navigate` para o hub correspondente com `?tab=`:

| Rota antiga | Destino |
| --- | --- |
| `/social-media` | `/marketing/content-hq?tab=redes` (respeitando `?platform=`) |
| `/social-media?platform=calendar` | `/marketing?tab=conteudo` |
| `/criacao` | `/marketing/content-hq?tab=criacao` |
| `/marketing/agencias` e sub-rotas | `/marketing/trafego-pago?tab=agencias` (detalhe e comparativo seguem como rotas próprias) |
| `/marketing-tasks` | `/marketing/projetos?tab=tarefas` |
| `/marketing/rebranding` | `/marketing/projetos?tab=rebranding` |
| `/marketing/market-intelligence` | `/marketing-insights?tab=market-intelligence` |

Rotas públicas (`/marketing/portal-agencia`, portal de relatório semanal) ficam intocadas.

## Detalhes técnicos

- Criar `src/components/marketing/_shared/MarketingTabsHub.tsx` espelhando `FinancialTabsHub`: aba ativa em `?tab=`, montagem lazy só da aba ativa, `Suspense` com skeleton.
- Converter as páginas atuais em componentes de aba reutilizáveis, sem reescrever a lógica interna — cada página vira o `Component` de uma aba.
- Ajustar `navItems` do setor `marketing` em `src/config/sectors.ts` para os 6 itens.
- Atualizar as rotas em `src/App.tsx` com os `Navigate` da tabela acima, preservando query params relevantes.
- Preservar o estado por aba já persistido em `localStorage` (Social Media/checklist) usando as mesmas chaves.
- Nenhuma mudança de schema, RLS ou edge function.

## Fora de escopo

ROAS por campanha, funil ponta a ponta, alertas de CPL/CAC e automações de IA (ondas 2 a 4) — ficam para depois da consolidação.
