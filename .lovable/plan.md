# Encerrar corretamente o cronômetro da 3C

## Diagnóstico confirmado

- A consulta principal do estado do agente (`/api/v1/agent`) está retornando 404 e o ROY cai para a consulta geral `/api/v1/agents/status`.
- Essa consulta reserva retorna o estado como número (`0`, `1`, `4` etc.), mas o leitor atual só interpreta estados escritos em texto. Assim, o ROY perde a transição real da chamada.
- O cartão mantém um estado local de “Chamando”. Quando a 3C informa que não há chamada ativa, esse estado ainda pode permanecer se o rótulo geral do agente continuar como “em chamada”.
- Enquanto está apenas “Chamando”, a atualização ocorre a cada 30 segundos e o limite de segurança atual é de 2 minutos. Por isso a captura ainda mostra `Chamando 00:55` mesmo sem ligação.
- Os registros recentes confirmam tentativas locais ainda em `dialing`, sem horário de término, inclusive a ligação para Suzana mostrada na captura.

## Correção

1. **Interpretar corretamente o estado reserva da 3C**
   - Tratar os códigos numéricos devolvidos pela lista de agentes, preservando separadamente o estado bruto, o início do estado e a existência real de chamada.
   - Não considerar “TPA/qualificação” como chamada ativa.

2. **Trocar o cronômetro por um ciclo de chamada explícito**
   - Estados: iniciando, chamando, atendida e encerrada.
   - Dar apenas uma pequena tolerância inicial para a 3C registrar a nova tentativa.
   - Depois que a chamada for detectada, a primeira confirmação de `has_active_call = false` encerra o cronômetro imediatamente, independentemente do rótulo geral do agente.
   - Se nunca houver chamada ativa, duas leituras consecutivas sem chamada após a tolerância encerram a tentativa; não esperar mais 2 minutos.

3. **Consultar rapidamente durante todo o ciclo**
   - Atualizar o estado a cada poucos segundos tanto em “Chamando” quanto em “Em chamada”.
   - Voltar ao intervalo normal de 30 segundos somente quando estiver ocioso.

4. **Usar o registro da ligação como segunda confirmação**
   - Vincular o cartão ao identificador local criado na discagem.
   - Se o registro receber horário de término, qualificação ou estado final, fechar o cronômetro mesmo que o estado geral da 3C esteja atrasado.
   - Ao encerrar, remover o cartão de chamada e deixar somente o lançador com status “Ocioso”, mantendo o discador disponível para abrir novamente.

5. **Cobrir os cenários que causaram o problema**
   - Ligação atendida e encerrada, seguida da tela de qualificação.
   - Tentativa não atendida, cancelada ou com falha.
   - Clique em sair/desligar dentro da 3C.
   - A consulta principal indisponível, usando os códigos numéricos da consulta reserva.
   - Nova ligação logo após uma anterior, sem reaproveitar cronômetro ou contato antigo.

## Arquivos envolvidos

- `supabase/functions/_shared/threecplus.ts`: leitura correta do estado numérico da consulta reserva.
- `supabase/functions/threecplus-agent/index.ts`: devolver ao painel o estado confiável e os dados de transição.
- `src/components/threecplus/ThreeCPlusPanel.tsx`: ciclo do cartão, atualização rápida e encerramento imediato.
- `src/components/sales/ThreeCPlusCallButton.tsx` e `src/lib/telephony/callEngines.ts`: repassar o identificador da tentativa ao cartão.

Não haverá mudança na forma de discar, no fallback existente, nas gravações ou no histórico de atividades.