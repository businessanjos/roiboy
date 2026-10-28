# Motivos de Perda só pelo "Registrar desfecho" + opção de ativar

## O que muda
1. **Gráfico de Motivos de Perda (aba Resultados de Renovações)** passa a usar apenas o motivo escolhido no modal "Registrar desfecho". O motivo gravado no contrato deixa de ser lido pelo gráfico. Quem não tem motivo registrado ali aparece como "Não informado".
   - A mesma regra vale para a lista de detalhes ao clicar na fatia, para a coluna Motivo da tabela e para a exportação em Excel, para que os números batam.
2. **Modal "Registrar desfecho"** ganha um terceiro botão ao lado de "Marcar como Renovado" e "Registrar Não Renovado": **"Manter ativo"**. Ele tira o contrato de renovado/não renovado e volta para em aberto (sem motivo), caso tenha sido marcado errado ou o cliente continue ativo.

## O que não muda
- Nenhum registro de cliente ou contrato é alterado automaticamente; as categorias fixas de motivo continuam as mesmas.
- Permissões e regras de quem pode registrar desfecho continuam iguais.

## Detalhes técnicos
- `src/components/renewals/RenewalLosses.tsx`: `loss_reason` passa a ser só `outcome?.loss_reason` (remove o fallback para `client_contracts.cancellation_reason`).
- Novo botão chama `saveRenewalOutcome` com `outcome: "pending"`, limpando `lossReason`/`lossNotes` (valor já permitido no banco; sem migração).
- Rodar os testes existentes de renovações.

Observação: entendi "ativar" como voltar o contrato para em aberto. Se for reativar o próprio contrato (status Ativo na ficha), me avise antes de aprovar.
