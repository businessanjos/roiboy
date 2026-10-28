# Editar a carta-proposta direto na prévia

## O que muda para o usuário
Na prévia, os quadros, faixas e blocos que você criou passam a ser editados ali mesmo, sem abrir janela:

- **Arrastar:** cada quadro, faixa e bloco ganha uma alça (⋮⋮) ao passar o mouse. É só arrastar para mudar a ordem dentro do grupo.
- **Adicionar onde quiser:** aparece um botão **+** entre os itens e no fim de cada grupo ("Detalhes da posição", faixas, blocos de texto). Ele cria o item exatamente naquele ponto.
- **Editar no lugar:** clicar no título ou no valor de um quadro/faixa/bloco abre a edição direto no texto. Enter ou clicar fora salva.
- **Mini-barra por item:** ao passar o mouse aparecem ícone (trocar ícone), duplicar e excluir.
- **Faixas em qualquer lugar:** dá para criar uma faixa logo abaixo de "Detalhes da posição", de "O que oferecemos" ou no fim da carta. Ela aparece no ponto escolhido.
- **Desfazer:** o botão Desfazer e o atalho Ctrl+Z valem para tudo que for feito na prévia.
- Os blocos fixos da carta (remuneração, métricas, assinatura) continuam abrindo a edição ao lado com um clique, como hoje.
- A janela "Adicionar e organizar" sai e dá lugar a essa edição direta. O botão + do canto continua para quem preferir.

A carta que o candidato recebe fica igual à prévia, mas sem alças, botões ou edição.

## Detalhes técnicos
- `OfferLetterView` recebe uma prop opcional `editable` (callbacks de add/update/remove/reorder). Ela só é usada no assistente; a página pública continua só de leitura.
- Arrasto com `@dnd-kit/sortable`, que já está instalado. Há um contexto por grupo (quadros, faixas, blocos).
- As faixas ganham o campo `anchor` (`after_details` | `after_benefits` | `end`), salvo em `custom_sections` com `kind: "strip"`. Não precisa mexer no banco.
- A edição no lugar usa `contentEditable` controlado ou um input inline, e o snapshot de desfazer é tirado no foco.
- O clique para editar ao lado ignora alças, botões e áreas que estão sendo editadas.
- Remover `OfferPreviewBuilder` e checar a tela com Playwright: arrastar, adicionar entre itens e editar o texto.
