---
name: HR Service Provider Kinds
description: Distinção entre PJ Diretor (cargo de confiança) e Prestador sob demanda em hr_service_providers
type: feature
---
`hr_service_providers.provider_kind` separa dois tipos de PJ:

- **director**: sócios/diretores PJ da Eternum, cargos de confiança (ex: Arthur, Jonathan, Jéssica Marcato, Maikol). Badge âmbar com coroa na listagem. NÃO mostra opção R&S. Aparecem no Organograma (`/rh/org-chart`) misturados aos colaboradores CLT — em diretores o profile exibe bloco "Posicionamento no Organograma" com Setor (`department`, vindo de `hr_departments`) e Cargo (`position`), obrigatórios para aparecer no organograma. ID no org chart é prefixado com `provider:` e clique abre `/rh/service-providers/:id`.
- **on_demand** (default): terceirizados sob demanda (LUMA Consultoria, escritório contábil, medicina ocupacional, etc.). Pode ser marcado como Parceiro de R&S. Não aparecem no organograma.

Tanto o dialog de criação quanto a página de edição (`HRServiceProviderProfile`) expõem o seletor de tipo e a flag de R&S apenas para `on_demand`.
