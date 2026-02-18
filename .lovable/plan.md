

## Adicionar card "Não Compareceu" nos detalhes do evento

### O que muda

Adicionar um novo card de estatística na seção de Quick Stats da página de detalhes do evento, mostrando quantos participantes convidados **não compareceram** (diferença entre participantes convidados e check-ins registrados).

### Mudancas tecnicas

**Arquivo: `src/pages/EventDetail.tsx`**

1. **Importar `UserX`** do lucide-react (linha 13-34) -- ícone de "usuário ausente"

2. **Adicionar `attendanceCount` ao state `stats`** (linhas 99-107) -- novo campo para armazenar quantos fizeram check-in

3. **Buscar contagem de attendance no `fetchStats`** (linhas 153-200):
   - Adicionar query: `supabase.from("attendance").select("*", { count: 'exact', head: true }).eq("event_id", id)`
   - Salvar como `attendanceCount` no stats

4. **Alterar grid de 6 para 7 colunas** (linha 369):
   - De `lg:grid-cols-6` para `lg:grid-cols-7`

5. **Adicionar novo card** após o card de "Participantes" (após linha 380):
   ```
   Card com ícone UserX em vermelho/10
   Valor: stats.attendeesCount - stats.attendanceCount (mínimo 0)
   Label: "Não Compareceu"
   ```

O cálculo é simples: `Math.max(0, participantes - checkins)`. Se ninguém fez check-in mas há 19 participantes, mostra 19. Se todos fizeram check-in, mostra 0.

