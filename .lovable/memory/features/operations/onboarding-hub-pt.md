---
name: Onboarding Hub
description: Área dedicada /operations/onboarding com jornada completa do cliente (13 etapas) reaproveitando OnboardingOrchestrated, badge âmbar na sidebar com contagem de novos
type: feature
---
Página `/operations/onboarding` (`src/pages/ClientOnboardingHub.tsx`) é o hub do time de Operações para receber clientes recém-ganhos. Reaproveita `OnboardingOrchestrated` (mesmo componente usado dentro de `/clients` no viewMode "onboarding") com a jornada completa de 13 etapas (display_order 0..12), começando em "Boas-Vindas — Consultor se apresenta" e terminando em "Plano de Ação 2/3".

**Critério "aguardando onboarding" (newCount, badge âmbar):** clientes com `status='active'` E (`stage_id IS NULL` OU `stage.display_order = 0`). É o que dispara o badge na sidebar.

**Critério "em andamento" (inProgressCount):** active + stage com `display_order < 9` (Plano de Ação 1 marca o fim do onboarding).

**Hook:** `usePendingOnboardingCount` em `src/hooks/usePendingOnboardingCount.tsx` (cache 60s) — usado pela `Sidebar.tsx` para renderizar Badge âmbar 500 ao lado do item "Onboarding" (visível só quando newCount > 0).

**Sidebar:** item adicionado ao setor `operacoes` em `src/config/sectors.ts` logo após `/clients` com ícone `Rocket`. Quando colapsada, badge vira mini no canto superior direito.

**Página inclui:** 3 KPIs (aguardando início, em andamento, etapas configuradas), banner âmbar quando há novos, busca por nome/empresa/telefone, botão "Configurar Etapas" abrindo `StageChecklistEditor`, e o orquestrador completo.

Não confundir com `/onboarding` (página `Onboarding.tsx`) que é o **wizard de SaaS** para novos usuários da plataforma.
