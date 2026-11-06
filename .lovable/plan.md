# Campos do Playbook: campo livre, formato do mês e ajuda da IA

## O que muda para quem usa
1. **Campo personalizado (+ Campo livre)**
   - Novo botão "+ Campo livre" ao lado de Link, Data, Mês...
   - Ao clicar, a pessoa dá um nome (ex.: "Local", "Palestrante", "Valor") e escreve o conteúdo.
   - O campo entra no texto onde está o cursor e aparece no quadro "Preencha os campos desta mensagem", para trocar dali sem reescrever a mensagem.
   - Dá para criar vários, renomear e remover (ao remover, o texto do campo volta a ficar escrito na mensagem, nada se perde).
   - Também aparece no preenchimento rápido na hora de enviar e na prévia do celular.

2. **Formato do mês**
   - Ao lado do mês, um seletor simples: **NOVEMBRO / Novembro / novembro**.
   - Padrão continua em maiúsculas; ao converter texto já escrito, o formato encontrado é mantido.
   - O mesmo seletor vale para o dia da semana (Sexta-feira / sexta-feira).

3. **Ajuda da IA (botão "Revisar com IA")**
   - Corrige ortografia e pontuação sem mudar o sentido nem os campos.
   - Sugere quais trechos fixos (datas, horários, links, nomes) podem virar campos, usando a mesma confirmação do "Converter texto em campos".
   - Mostra a sugestão lado a lado; só aplica se a pessoa clicar em "Usar sugestão".

4. **Organização da aba**
   - Os campos usados no texto ficam no topo; os botões de inserir ficam agrupados em "Inserir campo" com o campo livre por último.
   - Campo sem valor aparece destacado com "preencher" para não sair mensagem com lacuna.

## Detalhes técnicos
- `playbookEventVars.ts`: aceitar `{{campo:slug}}` com `customFields: {slug,label,value}[]` dentro dos dados do encontro já salvos no item (sem nova tabela); `weekdayCase` junto ao `monthCase`; testes para campos livres e formatos.
- `PlaybookEventFields.tsx`: botão campo livre, seletor de formato, edição/remoção.
- Envio (Playbook, sequências, `zapp-sequence-dispatcher`) usa a mesma função de substituição.
- Nova função de backend `playbook-ai-assist` via Lovable AI, retornando texto corrigido e sugestões estruturadas; nunca grava sozinha.
