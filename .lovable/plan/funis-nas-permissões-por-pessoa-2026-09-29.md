# Funis nas permissões por pessoa

## O que muda para o gestor
Em Configurações > Equipe > editar pessoa > "Permissões desta pessoa", aparece um bloco novo, **Funis**, com uma linha por funil. Hoje são quatro: Closer, SDR, Repescagem / Cadência e E-Pass / Clínica Ryka.

Cada funil tem três opções:
- **Só os dele (padrão):** a pessoa vê o funil, mas só os negócios em que é responsável, SDR, responsável pela renovação ou criadora.
- **Todos do funil:** a pessoa vê todos os negócios daquele funil (abertos, ganhos e perdidos).
- **Sem acesso:** o funil some do seletor de funis da pessoa, e ela não abre nenhum negócio dele, nem os próprios.

## Funil novo
Quando alguém cria um funil, ele entra automaticamente como **Só os dele** para todo mundo. Nada precisa ser configurado. Para liberar mais, o gestor entra nas permissões da pessoa e escolhe.

## Como convive com o que já existe
- As chaves de Negócios abertos, ganhos e perdidos ("Toda a equipe") continuam valendo para todos os funis de uma vez.
- "Todos do funil" libera a equipe inteira só naquele funil.
- "Sem acesso" em um funil vence as outras regras para aquele funil.
- Gestores e administradores continuam vendo tudo.
- A regra vale em todos os caminhos: funil, busca, lead, link direto, histórico e campos do negócio.

## Testes antes de entregar
Simular o Kleberson no banco:
1. Sem configuração, vê só os dele.
2. Com "Todos do funil" no Closer, vê todos do Closer e continua só os dele no SDR.
3. Com "Sem acesso" no SDR, não vê nenhum negócio do SDR e o funil some do seletor.
No fim, voltar tudo para o padrão.

## Detalhes técnicos
- Nova tabela `user_pipeline_access` (account_id, user_id, pipeline_id FK pipelines ON DELETE CASCADE, access `none|own|all`, UNIQUE user_id+pipeline_id), com GRANTs e RLS: cada um lê a própria linha, e só o gestor/admin (`can_manage_spiff_payments`) grava. Se não houver linha, vale `own`, e por isso um funil novo já nasce como "Só os dele" sem nenhum trigger.
- `can_view_deal` ganha o parâmetro `_pipeline uuid`, com esta ordem: gestor → pipeline `none` = false → dono = true → pipeline `all` = true → regras atuais (perfil/override por status, `user_deal_visibility`). As políticas de `deals` passam a enviar `pipeline_id`; `can_view_deal_id` também. A versão antiga da função é removida depois de trocar as políticas.
- Seletor de funis (usePipelines/Pipeline) filtra os funis `none` do usuário.
- UI: componente `UserPipelineAccessEditor` dentro de `UserPermissionsEditor`, com um Select por funil e salvamento imediato (upsert; `own` apaga a linha).
- Registrar a regra no AGENTS.md.
