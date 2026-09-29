
- Permissões granulares: Perfis de Permissão (`permission_profiles`/`_items`, `user_permission_profiles`, `user_permission_overrides`, RPC `get_user_permissions`, hook `useUserPermissions`). Why: gestor libera por módulo/alcance, no modelo da Clínica Ryka.
- Visibilidade de negócios via RLS restritiva `can_view_deal` (dono/SDR/renovação/criador, gestor, perfil com alcance "all" ou `user_deal_visibility`). Why: bloqueia todos os caminhos de acesso, não só a tela.
