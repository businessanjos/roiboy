

## Plano: Remover seção "Pipeline de Conversão"

### Alteração em `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

Remover o bloco condicional das linhas 140-149 que renderiza a seção "Pipeline de Conversão" com o componente `PipelineCards`.

Também remover `'pipeline'` do tipo `SectionId` se aplicável, e a importação de `PipelineCards` se não for mais usada em outro lugar.

