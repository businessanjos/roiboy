# Mesclagem de negócios

## Causa reproduzida
Escolher valores do negócio de origem não alterava o registro mantido. O diálogo sempre passava origem para exclusão e destino para retenção; o hook fazia operações separadas e exclusão definitiva, sem snapshot para reversão.

## Correção
- Escolha obrigatória e independente do negócio mantido, mostrando lead, telefone, criação e status. O vínculo de lead, etapa e status permanece no negócio escolhido.
- Campos não vazios marcados como retenção automática são efetivamente retidos.
- RPC transacional SECURITY INVOKER, mantendo RLS, com arquivamento em vez de exclusão definitiva e snapshots dos dois negócios, atividades, tarefas e campos.
- Desfazer no aviso de sucesso e na ficha do negócio para o autor da mesclagem; bloqueio se houve alteração posterior. Leads não são mesclados ou transferidos.

## Verificação
Sete testes passaram: ambos os destinos, retenção automática, restauração de vínculos/tarefas/campos conflitantes, repetição de desfazer bloqueada, alterações posteriores preservadas, rollback em falha e conta diferente recusada.
Na tela autenticada, com gravações bloqueadas, abri o diálogo, busquei Renata, confirmei botão desabilitado antes da escolha, selecionei ambos os destinos e cancelei. Screenshot inspecionada. Compilação automática sem erros.
Não executei mesclagem ou reversão em dados reais; o ciclo completo foi validado em banco isolado, não pela interface com gravação real.

## Caso anterior de Renata Caputo
A consulta somente leitura encontrou o negócio antigo criado em abril, perdido em julho, e a nota de mesclagem de 26/10 às 17:00 UTC. Não encontrou o outro negócio nem snapshot/auditoria com seus dados anteriores. A nova reversão não recupera mesclagens antigas. Nenhum registro real foi restaurado, movido ou recriado: seria necessário recuperar os dados anteriores ou confirmar uma correção manual específica antes de mexer nesse caso.

Sem publicação.