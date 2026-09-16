# Corrigir definitivamente o popup 3C no RoyZapp

## Problemas confirmados

- A janela está tecnicamente com posição livre, mas nasce com **66% da largura e 72% da altura da tela**. No RoyZapp ela cobre a parte inferior direita da conversa, inclusive o botão de gravar e enviar áudio, por isso continua parecendo fixa e atrapalhando o atendimento.
- A posição e o tamanho ficam salvos no navegador. Uma geometria ruim permanece após recarregar e mantém o problema no computador do vendedor.
- O arraste depende apenas da barra superior e não deixa uma indicação clara de que a janela pode ser movida.
- Ao trocar de lead, o conteúdo externo da 3C continua montado para preservar a chamada, mas o estado interno do ROY precisa distinguir com segurança: tentativa atual, chamada atendida, qualificação e encerramento. Isso evita reaproveitar nome ou cronômetro da ligação anterior.

## Ajuste

1. **Popup realmente compacto e solto**
   - Abrir em tamanho menor, no canto inferior direito, sem encostar no campo de mensagem e no botão de áudio.
   - Limitar a largura e a altura conforme o espaço disponível do RoyZapp, mantendo uma margem visível em todos os lados.
   - Migrar ou descartar automaticamente a posição antiga salva quando ela cobrir a área de envio.

2. **Movimentação confiável**
   - Tornar toda a barra superior uma alça de arraste explícita e capturar o ponteiro durante o movimento, inclusive quando ele sair da barra.
   - Manter o quadro da 3C sem capturar o mouse enquanto a janela é movida ou redimensionada.
   - Salvar a nova posição apenas ao terminar o movimento e manter a janela dentro da tela após redimensionamento ou troca de resolução.

3. **Áudio do RoyZapp sempre acessível**
   - Reservar a faixa inferior do chat para que o popup nunca nasça sobre gravar, parar, cancelar ou enviar áudio.
   - Ao iniciar uma gravação, recolher automaticamente o popup aberto para o cartão compacto; a ligação 3C continua ativa e o cronômetro permanece visível.
   - Depois, o vendedor pode reabrir o discador sem perder a gravação nem a chamada.

4. **Troca de lead sem resíduos**
   - Identificar cada tentativa de ligação e substituir imediatamente nome, telefone e tempo ao iniciar uma nova.
   - Encerrar o cronômetro e limpar o lead anterior quando a 3C informar fim da chamada, saída ou qualificação concluída.
   - Trocar de conversa no RoyZapp não encerra uma chamada ativa; o cartão compacto continua mostrando o lead correto e o tempo correto.

## Validação antes da entrega

- Abrir o RoyZapp com o discador disponível e confirmar visualmente que ele nasce como janela menor, com chat e áudio acessíveis.
- Arrastar para os quatro cantos, redimensionar e recarregar para validar posição e limites.
- Iniciar e parar uma gravação de áudio com o discador aberto e recolhido.
- Simular duas ligações consecutivas para contatos diferentes, concluir/qualificar a primeira e confirmar que nome e cronômetro reiniciam na segunda.
- Trocar de conversa durante uma chamada e confirmar que ela continua ativa no cartão compacto.
- Conferir erros no navegador e a compilação final.

Nenhuma alteração será feita na integração, nos registros de chamadas ou no fallback da 3C.
