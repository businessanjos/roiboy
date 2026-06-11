## O que será construído

Uma área nova dentro de **Eventos** para subir a transcrição de cada dia do evento, gerar o resumo via IA e exportar um PDF no padrão visual do "Resumo - Dia 1 - EC 15/03/2026" (capa com foto + DIA X + data, páginas creme com títulos dourados, citações em itálico com nome em negrito, blocos de destaque, rodapé "ETERNUM∞CLUB").

## Fluxo de uso

1. Em `Eventos → [evento] → aba "Resumos IA"` (ou nova rota `/events/:id/resumos`)
2. Botão **"Novo resumo"** → escolhe Dia (1, 2, 3…), data, e cola a transcrição (textarea grande) **ou** faz upload de `.txt`/`.pdf`/`.docx`
3. Clica em **"Gerar resumo com IA"** → edge function chama Gemini (Lovable AI Gateway) com um prompt estruturado que devolve JSON com seções (título da seção, parágrafos, citações com autor, destaques marcados, listas/cards)
4. Tela de **preview editável** — pode ajustar textos, adicionar/remover seções, marcar citações
5. Botão **"Exportar PDF"** → gera PDF client-side com `@react-pdf/renderer` no layout exato da referência
6. Lista de resumos do evento com status (rascunho / gerado / publicado) e download rápido do PDF

## Saída JSON da IA (formato)

```text
{
  "title": "DIA 1",
  "date": "15/03/2026",
  "sections": [
    {
      "heading": "Alinhamento de cultura e visão",
      "blocks": [
        { "type": "paragraph", "text": "..." },
        { "type": "quote", "author": "Bruna Pieri", "text": "..." },
        { "type": "highlight", "text": "Sem sacrifício, não há vitória." },
        { "type": "list", "title": "6 canais clássicos", "items": ["...", "..."] }
      ]
    }
  ]
}
```

## Banco de dados

Tabela `event_summaries`:
- `event_id` (FK events)
- `day_number`, `event_date`
- `transcript_text` (texto colado)
- `transcript_file_url` (storage opcional)
- `generated_content` (jsonb com a estrutura acima — editável)
- `status` (draft / generated / published)
- `pdf_url` (cache do último PDF, opcional)
- `created_by`, `created_at`, `updated_at`

RLS: mesmas regras dos outros recursos de evento (acesso a quem tem acesso ao setor Eventos).

## Edge function `generate-event-summary`

- Recebe `summary_id` + `transcript_text`
- Usa Lovable AI Gateway (`google/gemini-2.5-flash`) com prompt em PT-BR pedindo:
  - Identificar blocos temáticos do dia
  - Extrair citações literais de quem falou (Everton, Bruna, convidados)
  - Marcar 3-6 frases-chave como `highlight`
  - Listas e tabelas quando aparecerem
  - Manter o tom editorial e direto da referência
- Atualiza `generated_content` e marca `status = 'generated'`

## PDF (client-side com @react-pdf/renderer)

- Página A4 retrato, fundo creme `#FAF6EC`, cor de destaque dourada `#C9A86A`
- Capa: imagem de fundo do evento (puxa de `events.cover_url` se existir, fallback gradiente escuro) + "DIA X" branco gigante + data dourada
- Páginas internas: heading dourado bold, parágrafo serif/sans, citações em itálico com nome em bold, destaque em fundo amarelo-claro com `<mark>`, rodapé com logo "ETERNUM∞CLUB"
- Fonte: Inter para corpo + uma display tipo "Poppins"/"DM Sans" para títulos (já que vai pro PDF, embedar via @react-pdf)

## Arquivos a criar/editar

- `supabase/migrations/<ts>_event_summaries.sql` — tabela + RLS + grants
- `supabase/functions/generate-event-summary/index.ts` — chama Gemini
- `src/pages/events/EventSummariesList.tsx` — lista por evento
- `src/pages/events/EventSummaryEditor.tsx` — editor + preview
- `src/components/events/summary/SummaryPDF.tsx` — documento react-pdf
- `src/components/events/summary/SummaryPreview.tsx` — preview HTML editável
- `src/components/events/summary/SummaryBlockEditor.tsx` — adicionar/remover/editar blocos
- Rota nova em `src/App.tsx` + entrada no menu lateral de Eventos

## Confirmação necessária

Antes de partir pra implementação, só preciso confirmar **2 pontos**:

1. **Escopo do resumo**: por dia de evento (Dia 1, Dia 2…) — confirmando?
2. **Imagem da capa**: usar a `cover_url` do evento + texto "DIA X" sobreposto, ou prefere fazer upload de uma foto específica pra capa de cada resumo (como foi feito no PDF de referência com a foto do hall)?

Se confirmar, eu já implemento tudo de uma vez.