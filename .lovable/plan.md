# Separar "Calls Comerciais" em dois blocos: Comercial e Clínica Ryka (CR)

## O que muda na tela
No painel, o bloco **Calls Comerciais** vira dois, lado a lado (ou um abaixo do outro em tela estreita):

1. **Calls Comerciais**: mostra por vendedor quantas reuniões estão **a fazer** (Agend.) e quantas foram **feitas** (Conc.), contando **só os negócios fora do funil "E-Pass / Clinica Ryka"**.
2. **Calls Comerciais · Clínica Ryka (CR)**: mesmo visual e mesma contagem, mas **só os negócios do funil "E-Pass / Clinica Ryka"**.

## Regra de contagem (mantida igual nos dois)
- Base: atividades cadastradas dentro do negócio, com os tipos "Call Comercial Agendada" (a fazer, ainda não concluída, pela data prevista) e "Call Comercial Concluída" (feita, pela data de conclusão).
- **Sem duplicar**: cada negócio conta uma vez por vendedor em cada coluna, mesmo que tenha várias atividades.
- Respeita o filtro de período e de vendedor que já existe.

Nos últimos 60 dias, por exemplo: o funil CR tem 11 agendadas e 10 concluídas, que hoje entram somadas no bloco geral e passarão a aparecer só no bloco CR.

## Detalhes técnicos
- `fetchTasksCallCommercialData` (src/hooks/useVisualData.ts) ganha um parâmetro de escopo `pipelineScope: 'all' | 'exclude_cr' | 'only_cr'`, buscando `deals!inner(pipeline_id)` e filtrando pelo id do funil cujo nome contém "Clinica Ryka" (resolvido por conta).
- Novo campo no `VisualConfig` (`callScope`), com padrão `exclude_cr` para o bloco existente; nova receita "Calls Comerciais · Clínica Ryka" em `visualRecipes.ts` com `only_cr`.
- Inserir o novo bloco no mesmo painel, logo ao lado do atual, reaproveitando `ConfigurableCallCommercial`.
- Nenhuma mudança em banco, permissões ou dados.
