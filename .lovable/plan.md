# Encerrar corretamente o cronômetro da 3C

## Diagnóstico confirmado

- A consulta principal do estado do agente (`/api/v1/agent`) está retornando 404 e o ROY cai para a consulta geral `/api/v1/agents/status`.
- A 3C informa corretamente que não existe mais chamada ativa, mas pode manter o estado geral do agente como “em chamada” durante a qualificação pós-ligação.
- O painel já reconhece que `has_active_call = false` significa que a ligação acabou. Porém, a regra que apaga o cartão exige também que o estado geral deixe de ser “em chamada”. Essa contradição é a causa direta do cartão preso em `Chamando`.
- Enquanto está apenas “Chamando”, a atualização ocorre a cada 30 segundos e o limite de segurança atual é de 2 minutos. Por isso a captura ainda mostra `Chamando 00:55` mesmo sem ligação.
- Os registros recentes confirmam tentativas locais ainda em `dialing`, sem horário de término, inclusive a ligação para Suzana mostrada na captura.
- A consulta reserva devolve códigos numéricos de estado que o leitor atual não interpreta. Isso torna o rótulo geral menos confiável, mas não impede usar o sinal explícito de chamada ativa para encerrar o cartão.

## Correção

1. **Usar o sinal correto para encerrar**
   - Quando a 3C confirmar `has_active_call = false`, apagar imediatamente o estado local de discagem, mesmo que o agente ainda apareça como “em chamada” por estar qualificando.
   - Ao encerrar, zerar o cronômetro, retirar o cartão vermelho e mostrar o lançador normal como “Ocioso”.

2. **Evitar que o cartão suma antes da chamada começar**
   - Aplicar uma pequena tolerância logo após clicar em ligar, pois a primeira consulta pode acontecer antes de a 3C registrar a tentativa.
   - Após essa tolerância, leituras confirmando ausência de chamada encerram a tentativa sem aguardar dois minutos.

3. **Consultar rapidamente durante chamada e tentativa**
   - Atualizar o estado a cada poucos segundos tanto em “Chamando” quanto em “Em chamada”.
   - Voltar ao intervalo normal de 30 segundos somente quando estiver ocioso.

4. **Corrigir a leitura reserva sem adivinhar estados**
   - Preservar o código numérico e o horário de mudança devolvidos pela 3C para diagnóstico.
   - O fim da ligação continuará determinado pelo campo explícito de chamada ativa, sem transformar códigos numéricos não documentados em estados incorretos.

5. **Cobrir os cenários que causaram o problema**
   - Ligação atendida e encerrada, seguida da tela de qualificação.
   - Tentativa não atendida, cancelada ou com falha.
   - Clique em sair/desligar dentro da 3C.
   - A consulta principal indisponível, usando os códigos numéricos da consulta reserva.
   - Nova ligação logo após uma anterior, sem reaproveitar cronômetro ou contato antigo.

## Arquivos envolvidos

- `src/components/threecplus/ThreeCPlusPanel.tsx`: ciclo do cartão, atualização rápida e encerramento imediato.
- `supabase/functions/_shared/threecplus.ts`: preservar a resposta da consulta reserva sem confundir qualificação com chamada ativa.

Não haverá mudança na forma de discar, no fallback existente, nas gravações ou no histórico de atividades.