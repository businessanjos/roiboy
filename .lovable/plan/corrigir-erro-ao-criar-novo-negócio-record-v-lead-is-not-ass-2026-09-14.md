# Corrigir erro ao criar novo negócio ("record v_lead is not assigned yet")

## O que está acontecendo

Ao criar um negócio direto pela ficha do cliente (sem vir de um lead), o preenchimento automático de dados do cliente falha e o sistema mostra o aviso `record "v_lead" is not assigned yet`. Confirmei a causa no banco: a rotina que copia dados do negócio para o cadastro do cliente só busca os dados do lead quando existe um lead vinculado, mas usa esses dados do lead em todos os casos. Sem lead, ela quebra.

## Correção

Ajustar a rotina `fill_client_from_deal` para funcionar com ou sem lead:

- Quando não houver lead vinculado, usar apenas os dados do próprio negócio (nome, e-mail e telefone do contato).
- Quando houver lead, manter o comportamento atual: completar somente os campos vazios do cliente, nunca sobrescrever o que já existe.

Implementação: trocar o `RECORD` não inicializado por variáveis simples (e-mail, telefone, nome, CPF, CNPJ, empresa, data de nascimento, cidade, estado, instagram, segmento e nicho) carregadas do lead apenas quando ele existir, e usar essas variáveis no `UPDATE`. Sem mudança de regra de negócio e sem alterar o gatilho `trg_fill_client_from_deal`.

## Verificação

- Criar um negócio para um cliente sem lead vinculado e confirmar que salva sem aviso.
- Criar um negócio a partir de um lead e confirmar que os campos vazios do cliente continuam sendo completados.
