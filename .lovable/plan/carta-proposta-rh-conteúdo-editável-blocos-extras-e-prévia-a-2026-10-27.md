# Carta-proposta (RH): conteúdo editável, blocos extras e prévia ao lado

## O que muda para você

1. **Prévia ao vivo ao lado.** Na etapa "Conteúdo" (e em Design/Revisão), a tela se divide: à esquerda você edita e à direita aparece a carta como o candidato vai ver. A prévia muda enquanto você digita, sem precisar salvar. Em telas pequenas, um botão "Ver prévia" abre a carta por cima.

2. **Sugestões de métricas editáveis.** Os grupos de sugestões (Customer Success, Operações, Liderança etc.) ganham um botão discreto **"Editar sugestões"**, que abre uma janela onde você pode:
   - renomear, alterar a meta ou o prazo e excluir sugestões;
   - criar novos grupos e novas sugestões;
   - **"Redefinir para o padrão"**, que volta à lista original (com confirmação).
   As mudanças valem para toda a equipe de RH da conta. Cartas já enviadas não mudam.

3. **Textos padrão editáveis.** "Sobre a Eternum", "Próximos passos", quem assina e o cargo de quem assina viram **padrões da conta**. Eles já vêm preenchidos em toda carta nova. Cada carta continua podendo ser editada sozinha. Cada campo tem um botão **"Usar padrão"** para voltar ao texto padrão, e na janela de padrões existe **"Redefinir para o padrão original"**.

4. **Blocos extras.** O botão **"+ Adicionar bloco"** cria seções livres com título e texto (ex.: "Seu primeiro mês", "Cultura", "Plano de carreira"). Você pode reordenar os blocos com setas e excluí-los. Eles aparecem na carta pública com o mesmo visual das outras seções, antes de "Próximos passos".

## O que não muda
- O envio, o link público, aceitar/recusar oferta, os modelos e as permissões continuam iguais.
- Nenhuma carta existente é alterada. Cartas antigas sem blocos extras aparecem como hoje.

## Detalhes técnicos
- Nova coluna `hr_job_offers.custom_sections jsonb default '[]'` (`[{id,title,body}]`). Ela é salva no autosave, clonada em modelos e lida pelo PublicJobOffer.
- Nova tabela `hr_offer_content_settings` (uma linha por conta): `kpi_packs jsonb`, `company_intro`, `next_steps`, `signer_name`, `signer_role`, `updated_by`, `updated_at`. Ela tem GRANTs, RLS por `account_id` e escrita limitada a quem já acessa o RH. Se a linha não existir ou estiver nula, valem as constantes atuais (`kpiSuggestions.ts`, `DEFAULT_COMPANY_INTRO`, `DEFAULT_NEXT_STEPS`). "Redefinir" grava null.
- `suggestKpis` passa a aceitar os grupos da conta. Com grupos customizados, eles são mostrados todos (o usuário escolhe), e a busca por cargo continua só nos grupos padrão.
- O corpo da carta sai de `PublicJobOffer.tsx` para um componente `OfferLetterView` que recebe os dados por props. A página pública e a prévia usam o mesmo componente, então a prévia é idêntica e não depende de salvar. O iframe atual de pré-visualização continua como "Abrir em nova aba".
- Layout: `lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]`, com a prévia fixa (sticky) e rolagem própria, escalada por zoom.
