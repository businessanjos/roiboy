## Diagnóstico inicial (Dashboard + Fluxo de Caixa já abertos)

**Bugs visuais confirmados:**
- **Gráfico "Evolução do Saldo"** (Fluxo de Caixa): o eixo Y está cortando os números — mostra `50.000,00`, `30.000,00`, `50.000,00`, `0,00`, `50.000,00` quando deveria ser `150.000`, `130.000`, `250.000` etc. Largura insuficiente para o tick.
- **Card "Dados Omie"** (Dashboard): bloco gigante e vazio (~300px de altura desperdiçada) quando não há retorno.
- **"Carregando…" full screen** entre cada navegação interna — quebra a sensação de SPA. Causa: Suspense fallback global engole o layout.
- **"EMPRESA / CNPJ"** no breadcrumb — label técnico de programador, deveria ser apenas "Empresa".
- **"ROY zAPP"** cortado no rodapé do sidebar (overflow não tratado).

**Problemas de UX recorrentes (suspeitos, a confirmar nas demais telas):**
- KPIs com cores fortes demais (verde berrante, vermelho gritante) sem hierarquia visual.
- Métricas críticas sem contexto (ex.: `Inadimplência R$ 64,7M / 78,1%` em vermelho enorme, sem explicação ou ação).
- `Taxa de Cobrança 0,0%` provavelmente é cálculo quebrado, não realidade.

---

## Escopo aprovado

**Onda 1 — 7 telas de uso diário** (4.700 linhas no total):
Dashboard, Fluxo de Caixa, Lançamentos, Contas Bancárias, Parcelas, CRM de Cobrança, Conciliação.

**Profundidade**: redesign profundo (pode reagrupar fluxos, fundir telas, repensar IA).
**Testes**: liberdade total, inclusive escrita no banco.

---

## Plano em 4 fases

Cada fase é uma rodada separada com PR pequeno e revisável. Faço uma fase por mensagem; você aprova e seguimos.

### Fase 1 — Fundação visual + correções críticas (esta rodada)
Aplica-se a **todas as 7 telas** de uma vez, sem reescrever lógica:

1. **Componente `FinancialPageHeader`** padronizado (título, descrição, ações, period picker) — substitui 7 cabeçalhos divergentes.
2. **Componente `FinancialKpiCard`** padronizado com:
   - Hierarquia: label pequeno → valor grande → contexto/delta abaixo.
   - Cores sutis no fundo, valor em `text-foreground`, sinal de tendência em verde/vermelho do design system (não hardcoded).
   - Estado vazio ("—") e skeleton.
3. **Corrigir gráfico do Fluxo de Caixa**: largura mínima do eixo Y (`width={80}`), formatador `R$ XX mil / XX M`.
4. **Remover full-screen "Carregando…"** entre rotas: trocar Suspense global por skeleton de página.
5. **Esconder card "Dados Omie" vazio** + estado vazio amigável quando sem dados.
6. **Breadcrumb**: "EMPRESA / CNPJ" → "Empresa".
7. **Sidebar**: corrigir corte do "ROY zAPP" (padding-bottom + overflow).

### Fase 2 — Redesign do Dashboard e Fluxo de Caixa
1. Dashboard: novo layout em seções com narrativa ("Saúde do Mês" → "Recebíveis" → "Inadimplência" → "Tendências"), cada métrica vermelha com **CTA acionável** ("Ver inadimplentes", "Abrir CRM de Cobrança").
2. Fluxo de Caixa: tabs claras Realizado / Previsto / Projeção, drill-down por categoria, exportar CSV.
3. Validar todas as fórmulas (Taxa de Cobrança, Inadimplência %, MRR vs ARR) com queries no banco.

### Fase 3 — Operação diária: Lançamentos, Parcelas, Contas Bancárias
1. **Lançamentos** (1.180 linhas — campeão de complexidade): filtros persistentes, colunas amigáveis, ações em massa, modal de criação simplificado em wizard de 2 passos.
2. **Parcelas**: agrupamento por cliente/contrato, badges de status com ícone, ação "Renegociar" em destaque.
3. **Contas Bancárias**: card por banco com saldo grande + último sync + CTA único "Atualizar", esconder IDs técnicos.

### Fase 4 — Cobrança e Conciliação
1. **CRM de Cobrança** (kanban): colunas claras, cards com avatar do cliente, valor em destaque, dias em atraso colorido, WhatsApp direto.
2. **Conciliação**: split view (movimentação bancária ↔ lançamento sugerido), match com 1 clique, confiança em %.

---

## Detalhes técnicos (para quem lê código)

- Criar `src/components/financial/_shared/` com `FinancialPageHeader.tsx`, `FinancialKpiCard.tsx`, `FinancialEmptyState.tsx`, `FinancialPageSkeleton.tsx`.
- Centralizar formatadores em `src/lib/financial-format.ts` (`formatBRL`, `formatBRLCompact`, `formatPct`, `formatPeriod`).
- Suspense por rota usando `<Suspense fallback={<FinancialPageSkeleton/>}>` dentro do `FinancialLayout` em vez de fallback global.
- Tokens HSL já existentes em `index.css` — sem cores hardcoded.
- Testes manuais por tela documentados ao final de cada fase (o que cliquei, o que escrevi no banco, o que reverti).

---

## O que eu **não** vou fazer sem perguntar

- Não vou apagar/fundir telas (ex.: juntar Boletos+Parcelas) sem confirmar.
- Não vou mexer em RLS, edge functions, ou contratos de dados.
- Não vou alterar a lógica de cálculo financeiro antes de validar no banco e te mostrar o resultado.

---

## Próximo passo

Aprovando este plano, começo **agora pela Fase 1** (fundação visual + 5 bugs críticos). Estimativa: 1 rodada. Depois te chamo para revisar e seguimos para Fase 2.