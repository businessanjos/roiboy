# Tirar o Darlan de gestor e criar Perfis de Permissão (modelo Clínica Ryka)

## Etapa 1: Darlan (imediato)
- **Por que ele conta como gestor hoje:** além do cargo "Comercial · Closer", o Darlan tem o cargo extra **"Admin"** na equipe. Esse cargo extra libera tudo o que é de gestor: ver todos os negócios, marcar prêmio como pago, aprovar giros etc.
- **O que muda:** o cargo extra "Admin" sai do cadastro dele. Ele fica só como Closer e passa a ver apenas os próprios negócios.
- **O que ele mantém no RoyZapp:** ele continua como **supervisor**, ou seja, vê a fila do Comercial e transfere conversas quando o gestor estiver ausente. Essa liberação fica só no RoyZapp e não dá nenhum outro poder no sistema.

## Etapa 2: Perfis de Permissão (no mesmo padrão da Clínica Ryka)
Uma tela nova em Configurações > Permissões > **Perfis**.
- O gestor cria perfis (por exemplo "Closer", "SDR", "Closer substituto de gestor") e marca, módulo a módulo, o nível de acesso: **Sem acesso**, **Visualizar** ou **Editar**.
- Onde fizer sentido, também escolhe o alcance: **Só os próprios** ou **Toda a equipe**.
- Cada pessoa recebe um perfil. Se precisar liberar algo pontual, dá para ajustar só para aquela pessoa, sem mexer no perfil.
- Os cards mostram a contagem de itens em "editar", "visualizar" e "sem acesso", igual na Ryka.

Primeiros módulos do perfil:
```text
Comercial   Negócios abertos / ganhos / perdidos (alcance próprio ou equipe)
            Leads, Dashboard de vendas, Ranking, SPIFFs (aprovar giro, marcar pago)
            Calls e análises, Contratos digitais
RoyZapp     Conversas, Transferir conversas, Fila do setor, Análises
Gestão      Metas, Comissões, Equipe, Logs
```
As três chaves de "Visibilidade de negócios" criadas agora passam a fazer parte do perfil. Nada do que já foi liberado se perde.

## Detalhes técnicos
- Etapa 1: apagar a linha de `user_team_roles` que liga o Darlan (1d090543-1853-4cd0-bdb4-02e17a5df4d8) ao cargo "Admin". Conferir e, se precisar, ajustar o papel dele no RoyZapp para `supervisor` (zapp_agent_role). Depois confirmar que `can_manage_spiff_payments` passa a devolver false para ele.
- Etapa 2: criar as tabelas `permission_profiles` (nome, conta), `permission_profile_items` (profile_id, module, sub_item, access_level none/view/manage, scope own/all), `user_permission_profiles` e `user_permission_overrides`, cada uma com GRANTs e RLS por conta (só gestor/admin altera). Criar a RPC `get_user_permissions()` e um hook `useUserPermissions().can(module, sub, level)`.
- `can_view_deal` passa a ler o alcance do perfil em vez de `user_deal_visibility`; os dados atuais são migrados para o perfil ou para o override de cada pessoa.
- A troca das regras antigas pelas novas (RLS e checagens na tela) é feita aos poucos, módulo por módulo, começando pelo Comercial e pelo RoyZapp.
