# Corrigir vídeos no RoyZapp de CS

## Diagnóstico confirmado
- Os vídeos da conversa mostrada foram baixados e marcados como `completed`, mas o arquivo salvo continua criptografado; por isso o player não reconhece o conteúdo.
- A função atual captura falhas de descriptografia e, indevidamente, grava os bytes criptografados como se fossem um vídeo válido.
- Há também mensagens com link de Instagram classificadas como documento sem URL de mídia, deixando o estado “Carregando mídia...” preso.

## Implementação
1. Endurecer `download-media`: validar a descriptografia e a assinatura/formato do arquivo antes do upload; nunca salvar conteúdo criptografado como mídia concluída; retornar erro/status correto e permitir retry real.
2. Corrigir a classificação no webhook para mensagens de texto/link sem mídia não receberem `media_type=document`.
3. Ajustar a UI e o retry: mostrar estado terminal para mídia abandonada/corrompida, reabilitar uma tentativa manual de arquivos já marcados como concluídos mas inválidos e atualizar a bolha após a função responder.
4. Reprocessar os vídeos afetados do RoyZapp de CS e normalizar os links presos na conversa do print.
5. Publicar as funções alteradas e validar no banco, nos logs e no player do navegador que os arquivos têm formato de vídeo reproduzível.

## Segurança e consistência
- Manter isolamento por conta no download manual.
- Não expor URLs criptografadas nem chaves de mídia ao cliente.
- Preservar o limite para mídias muito grandes, exibindo erro explícito em vez de carregamento infinito.
