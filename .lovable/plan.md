# Trocar modelos de IA desatualizados

Cerca de 70 chamadas de IA nas funções do backend usam modelos antigos ou com data para sair do ar até 13/12/2026. A troca mexe em muitas telas (RoyZapp, vendas, RH, marketing, financeiro, CS), então vai em etapas.

## O que muda
1. Conferir na lista atual de modelos quais estão desatualizados (gemini-2.5-flash/pro/flash-lite, gemini-3-*-preview, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.2, gpt-image, gpt-image-2).
2. Para cada uso, escolher o substituto ativo mais próximo:
   - texto rápido/barato -> modelo leve atual do mesmo tipo;
   - análises mais pesadas (calls, auditorias, insights) -> modelo forte atual;
   - imagens -> modelo atual de imagem (geração e edição).
3. Mudar só o nome do modelo e os ajustes que o novo modelo exige. Limites de tamanho de resposta, avisos de erro e repetições continuam iguais.
4. Testar uma chamada real por função alterada e publicar as funções.

## Fica igual
- Os modelos que já estão atualizados (gpt-6-astra, gemini-3.5-transcribe).
- Comandos, telas e regras.

## Detalhes técnicos
- Em `supabase/functions/*`, via `rg`. Os campos que o novo modelo não aceita (temperature/top_p no astra, max_tokens -> max_completion_tokens) só mudam onde for necessário.
- Mapeamento final a partir de `GET /v1/models` (data_retention zero ou permitido).
- Nada publicado no app.
