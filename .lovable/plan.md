
# Plano: Área de RH no ROY (importando LIDERANÇA RYKA)

## Visão Geral
O projeto LIDERANÇA RYKA possui ~30 páginas com funcionalidades de RH completas: testes comportamentais (DISC, Big Five, Eneagrama, Temperamento), gestão de colaboradores, equipes, avaliações de desempenho, feedbacks, procedimentos, descrição de cargos, banco de currículos, código de ética, manual do colaborador, scripts de entrevista, etc.

## ⚠️ Considerações Importantes
- O LIDERANÇA RYKA usa seu **próprio banco de dados Supabase** com tabelas específicas (collaborators, organizations, disc_results, teams, etc.)
- Possui seu **próprio sistema de auth e organizações** independente do ROY
- **Será necessário criar todas as tabelas no banco do ROY** via migrações
- A portagem completa pode levar **várias iterações** devido ao volume

## Fases Propostas

### Fase 1 — Fundação (esta sessão)
1. **Adicionar o setor "RH" no config/sectors.ts** com rotas e ícone
2. **Adicionar o card de RH na tela de setores** (Sectors.tsx)
3. **Criar a página principal de RH** (`/rh/dashboard`) com visão geral das funcionalidades
4. **Criar as migrações de banco** para as tabelas principais (collaborators, teams, etc.)

### Fase 2 — Colaboradores e Equipes
5. Portar páginas: Collaborators, CollaboratorProfile, Teams, TeamDetail
6. Registros de RH: faltas, movimentações, advertências, treinamentos

### Fase 3 — Testes Comportamentais
7. Portar DISC, Big Five, Eneagrama, Temperamento (testes + resultados)
8. Sistema de convites para testes

### Fase 4 — Gestão de Pessoas
9. Avaliações de desempenho, sessões de feedback
10. Avaliações de candidatos, scripts de entrevista
11. Banco de currículos, descrição de cargos

### Fase 5 — Documentos Organizacionais
12. Procedimentos, código de ética, manual do colaborador
13. Missão/Visão/Valores

## Vamos começar pela Fase 1?
