# Campos que mudam: inserir no cursor, reconhecer o texto e prévia de celular

## O que muda para a consultora

1. **A variável entra onde o cursor está.** Hoje "+ Link" e os outros botões colocam a variável no fim do texto. Vão passar a colocá-la onde o cursor estiver. Se houver um trecho selecionado, a variável substitui esse trecho. Se o campo de texto ainda não foi clicado, aí sim ela vai para o fim.

2. **Botão "Converter texto em campos".** O sistema procura no texto o que já está escrito à mão. Exemplo com a mensagem do Encontro:
   - "falta 1 dia" vira Contagem;
   - "06/11" vira Data, com o ano atual (ou o próximo, se a data já passou);
   - "(sexta-feira)" vira Dia da semana;
   - "15h às 17h" vira Horário, preenchendo Início 15:00 e Fim 17:00;
   - "NOVEMBRO" vira Mês, mantendo as letras maiúsculas;
   - o endereço https vira Link.

   Antes de aplicar, aparece a lista "Encontrei: Data 06/11, Horário 15h às 17h...", com uma caixinha para cada item. Ela confirma, e o texto troca esses trechos pelas variáveis. Os valores ficam preenchidos nos campos de baixo, então ela não precisa digitar nada de novo. Dia da semana, contagem e mês continuam sendo calculados a partir da data.

3. **Aba mais organizada**, em três partes:
   - **Campos no texto:** botões compactos, com ✓ nos que já estão no texto.
   - **Valores:** Link, Data (calendário ROY), Início e Fim, com uma linha "calculado sozinho".
   - **Prévia:** aparelho de celular igual ao da Sequência (print 3), com o balão verde do WhatsApp mostrando a mensagem já preenchida e a imagem, quando houver.

4. **Lado a lado na tela grande:** à esquerda, o formulário. À direita, o celular de prévia, que fica parado enquanto ela rola o formulário. Em telas pequenas, a prévia fica abaixo do formulário.

## Detalhes técnicos

- `WhatsAppFormattingToolbar`: passa a expor a posição do cursor e a seleção do campo, com `forwardRef`/`onSelectionChange`. O `insert` do `PlaybookItemForm` usa essa posição em vez de juntar a variável no fim do texto.
- `src/lib/playbookEventVars.ts`: nova função pura `detectEventPlaceholders(text, now)`, que devolve os trechos encontrados (data dd/mm, dia da semana entre parênteses ou solto, horário "Xh às Yh"/"Xh-Yh", contagem "falta(m) N dia(s)"/"é hoje", mês por extenso e URL), o texto já convertido e os `PlaybookEventVars` deduzidos. O mês respeita maiúsculas e minúsculas: a saída de `mes_evento` segue o formato original, com uma nova opção `monthCase`.
- Testes no `playbookEventVars` com a mensagem real do Encontro: conferem a detecção de cada campo e que a conversão seguida de aplicação devolve o mesmo texto.
- Prévia: reutilizar `PlaybookSequencePreview` em `messageOnly`, com um único passo montado a partir do item em edição (texto/legenda + mídia) e `replaceVariables` aplicando as variáveis do encontro.
- Layout do diálogo: grade `lg:grid-cols-[1fr_340px]` com a prévia `sticky`. Nenhuma mudança no envio, no banco ou nas permissões.
