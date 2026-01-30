# Memory: features/roy-zapp/sector-isolation-and-multi-sector-groups-pt
Updated: now

O RoyZapp implementa um sistema de isolamento de setor com lógica diferenciada para grupos:

## Contatos Individuais
Para manter o isolamento rigoroso de tickets, se uma conversa privada de outro setor for aberta, a seleção é limpa automaticamente com a mensagem "Conversa individual pertence a outro setor".

## Grupos (Multi-setor)
Grupos suportam atendimento multi-setor com controle manual:

1. **Abrir via "Nova Conversa"**: Quando o usuário pesquisa e abre um grupo via "Nova Conversa", o sistema cria um assignment no setor atual (status: 'triage' ou 'active').

2. **Persistência**: O grupo permanece visível na barra lateral esquerda até que o usuário explicitamente clique em "Dispensar".

3. **Botão "Dispensar grupo"**: Disponível no menu de ações (⋮) do header da conversa e também no menu do item da lista. Ao clicar:
   - O assignment é marcado como 'closed'
   - O grupo sai da lista lateral
   - Outros setores não são afetados

4. **Diferença entre Dispensar vs Excluir**:
   - **Dispensar**: Apenas fecha o assignment no setor atual (reversível via "Nova Conversa")
   - **Excluir**: Deleta permanentemente a conversa e mensagens (afeta todos os setores)

Isso permite que múltiplos setores (ex: Operações e Vendas) acompanhem o mesmo grupo do WhatsApp simultaneamente, cada um com seu próprio ticket e agente responsável.
