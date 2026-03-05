

## Plano: Mover Insights Marketing para página própria no menu lateral

### Alterações

#### 1. `src/config/sectors.ts`
- Adicionar item `{ to: "/marketing-insights", icon: BarChart3, label: "Insights" }` ao array `navItems` do setor `marketing`

#### 2. `src/App.tsx`
- Adicionar rota `<Route path="/marketing-insights" element={<MarketingInsightsPage />} />`
- Lazy import do novo componente de página

#### 3. Nova página: `src/pages/MarketingInsights.tsx`
- Página simples com header "Insights Marketing" e renderiza `<MarketingInsightsTab />`

#### 4. `src/pages/Marketing.tsx`
- Remover a aba "Insights" do `TabsList` e o respectivo `TabsContent`
- Remover import do `MarketingInsightsTab` e `BarChart3`

