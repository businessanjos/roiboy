# Conferência dos filtros por Item da Venda

Regra: o produto selecionado no filtro deve reconhecer o mesmo Item da Venda exibido no negócio, mesmo quando um registro usa o código de opção e outro usa o ID do produto. Comparação de leitura apenas: nenhuma venda, contrato, configuração ou permissão é regravada.

## Caminhos verificados por leitura de código

| Lugar | Resultado |
|---|---|
| Pipeline em quadro/lista, filtro personalizado salvo | Comparava texto literalmente: corrigido para equivalência do mesmo produto, sem confundir renovação com venda nova. |
| Pipeline, aba Produtos dos filtros | Mesmo problema com opções antigas: corrigido no comparador compartilhado. |
| Criar/editar filtro, prévia | Usava apenas campos do filtro já aplicado: corrigido para carregar os campos da condição em edição, integralmente e com estado de erro/carregamento. |
| Filtros de outros campos personalizados | Leitura podia ser cortada por limite de página: corrigida com paginação por lote. Lista múltipla vazia agora é vazia; datas personalizadas usam os operadores do seletor. |
| Exportar Pipeline, filtro Produto | Comparava somente ID: corrigido com o mesmo comparador e paginação completa dos campos; leitura de negócios com ordem determinística. |
| Cartão Kanban, detalhe do negócio, campos personalizados e editor | Resolvem códigos de opção e IDs para exibição/seleção; sem a falha de comparação do filtro CR. Preservados. |
| Detalhe do lead, negócio do cliente e criação no RoyZapp | Exibição resolve ID/opção; criação grava produto escolhido, sem filtro personalizado equivalente. Preservados. |
| Insights: filtros unificados e legados de campos, escopo de produto de metas, enriquecimento de produto | Já reconciliam nomes/opções/IDs nos filtros por produto. Preservados. |
| SPIFFs, janela de vendas, painel por pagamento, auditoria de produtos, parcelas financeiras e seletor de vínculo de calls | Já usam resolução de opção/ID para o produto-alvo. Preservados; nenhum cálculo de pagamento ou resultado encerrado alterado. |
| Cotas legadas | Usa catálogo histórico próprio de produtos; não aplica o filtro personalizado do Pipeline. Preservado para não reclassificar metas/vendas liquidadas. |
| Cadastro/edição de negócio, contrato digital e mapeamento negócio–contrato | Aceitam produto escolhido por ID ou resolução da opção antes do fluxo próprio. Preservados. |
| Função create-deal e gatilho bulk_deal_item_apply | Gravam ID validado do produto; formato correto, agora reconhecido pela leitura. Nenhuma alteração no servidor. |
| Typeform webhook e proxy das TVs | Não executam o comparador do Pipeline; preservados. |
| RLS de campos, definições e filtros | Consultada e preservada: o erro reproduzido era a comparação de dois códigos, não ausência de acesso. |

## Reprodução real

Filtro salvo “Leads CR”: `custom:033b91fb-3add-4c96-aec9-567fefbd0fb2`, `equals`, opção `opt_1787176918301`.

Cartão informado usa produto `feb34040-ba60-417a-a5d3-66dbdf1cfc02`. Antes: zero. Depois: 16 de 588, com Fabienne incluída no quadro, lista e detalhe. EM: 455; EC: 71; MVP: 22; EP: 3; Conselho: 7. Prévia de CR criada sem filtro aplicado: 16 de 588, cancelada sem salvar. Telas 390/794/1440 px verificadas sem rolagem lateral da página ou erros de execução.

49 testes passaram, incluindo outros produtos, renovações separadas, inclusão/exclusão, combinações TODAS/QUALQUER, zero/falso, lista vazia, datas e servidor com teto de paginação reduzido. Não publicado.

Exportação real: selecionado Em Aberto + CR, 321 linhas entre todos os funis, com Fabienne incluída. O arquivo foi analisado somente na área temporária e descartado; nenhuma alteração de registros.