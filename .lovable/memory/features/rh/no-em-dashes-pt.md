---
name: No Em-Dashes on Candidacy Pages
description: Páginas públicas de candidatura (PublicJobApplication) não podem conter travessões — ou –
type: constraint
---
- Nunca use travessões (— em-dash, – en-dash) em textos das páginas de candidatura (`/vagas/:id/aplicar`, `PublicJobApplication.tsx`, perguntas padrão, textos de UI).
- Substitua por vírgula, ponto ou ", " conforme o sentido.
- O renderer de descrição em `PublicJobApplication.tsx` já limpa `—`/`–` automaticamente via `.replace(/\s*[—–]\s*/g, ", ")`. Não remover esse safety net.
- **Why:** Decisão do usuário — travessões parecem "texto de IA" e devem ser evitados em comunicação com candidatos.
