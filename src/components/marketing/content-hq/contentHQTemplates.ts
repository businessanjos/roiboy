// Briefing templates by platform/format + operational checklists per kanban stage.
// Used in Kanban drawer to transform pautas into posts.

export type BriefingTemplate = {
  id: string;
  label: string;
  sections: { key: string; label: string; placeholder: string; rows?: number }[];
};

export const BRIEFING_TEMPLATES: Record<string, BriefingTemplate> = {
  reels: {
    id: "reels",
    label: "Reels / TikTok / Shorts",
    sections: [
      { key: "angle", label: "Ângulo / Tese", placeholder: "Qual é a perspectiva única? Que crença vamos quebrar?", rows: 2 },
      { key: "hook", label: "Hook (0–3s)", placeholder: "Frase de impacto, pergunta provocativa ou pattern interrupt.", rows: 2 },
      { key: "script", label: "Roteiro (estrutura)", placeholder: "0–3s Hook · 3–10s Contexto · 10–35s Desenvolvimento · 35–50s Prova · 50–60s CTA", rows: 8 },
      { key: "broll", label: "B-roll / Cenas", placeholder: "Lista de planos, ambientes, demonstrações, gráficos a inserir.", rows: 3 },
      { key: "onscreen", label: "Texto na tela", placeholder: "Legendas curtas para reforçar pontos-chave a cada 2-3s.", rows: 3 },
      { key: "cta", label: "CTA", placeholder: "Salva esse post · Comenta X · DM 'palavra' · Link na bio", rows: 1 },
      { key: "caption", label: "Legenda", placeholder: "Primeira linha = hook. Texto + CTA + hashtags.", rows: 4 },
      { key: "hashtags", label: "Hashtags", placeholder: "#estetica #clinica #mentoria (mistura nicho + amplas)", rows: 1 },
      { key: "thumb", label: "Capa / Thumbnail", placeholder: "Composição, expressão, texto principal (máx 4 palavras), cor de destaque.", rows: 2 },
    ],
  },
  youtube_long: {
    id: "youtube_long",
    label: "YouTube (Long-form)",
    sections: [
      { key: "title", label: "Título (SEO + curiosidade)", placeholder: "Inclua palavra-chave + gatilho. <60 chars.", rows: 1 },
      { key: "angle", label: "Promessa do vídeo", placeholder: "Que transformação o espectador terá ao final?", rows: 2 },
      { key: "hook", label: "Hook (0–15s)", placeholder: "Promessa + stake + preview do payoff.", rows: 3 },
      { key: "script", label: "Roteiro completo", placeholder: "Intro · Capítulos · Provas/Histórias · CTA · Outro", rows: 14 },
      { key: "chapters", label: "Capítulos (timestamps)", placeholder: "00:00 Intro\n01:30 Capítulo 1\n...", rows: 4 },
      { key: "broll", label: "B-roll / Inserts", placeholder: "Demonstrações, gráficos, depoimentos, casos.", rows: 3 },
      { key: "cta", label: "CTA primário + secundário", placeholder: "Inscrição · Comentário · Lead magnet · Próximo vídeo", rows: 2 },
      { key: "description", label: "Descrição (SEO)", placeholder: "Resumo + bullets + links + hashtags + créditos.", rows: 5 },
      { key: "thumb", label: "Thumbnail", placeholder: "Conceito visual, expressão, texto (3-5 palavras), contraste.", rows: 2 },
    ],
  },
  carousel: {
    id: "carousel",
    label: "Carrossel (Instagram / LinkedIn)",
    sections: [
      { key: "angle", label: "Tese central", placeholder: "Uma frase que resume o aprendizado.", rows: 1 },
      { key: "hook", label: "Slide 1 — Capa", placeholder: "Título de impacto + subtítulo que cria curiosidade.", rows: 2 },
      { key: "script", label: "Slides 2–N", placeholder: "Slide 2: Problema\nSlide 3: Causa\nSlide 4: Framework\nSlide 5: Exemplo\nSlide 6: Aplicação\nSlide 7: CTA", rows: 10 },
      { key: "design", label: "Direção visual", placeholder: "Paleta, tipografia, ícones, hierarquia, espaço em branco.", rows: 2 },
      { key: "cta", label: "CTA (último slide)", placeholder: "Salva · Compartilha com colega · DM palavra · Link na bio", rows: 1 },
      { key: "caption", label: "Legenda", placeholder: "Hook + contexto + bullets + CTA.", rows: 4 },
      { key: "hashtags", label: "Hashtags", placeholder: "#estetica #gestaodeclinica ...", rows: 1 },
    ],
  },
  feed_static: {
    id: "feed_static",
    label: "Post estático (Feed / Pinterest)",
    sections: [
      { key: "angle", label: "Mensagem única", placeholder: "Uma ideia que cabe em uma imagem.", rows: 1 },
      { key: "design", label: "Direção visual", placeholder: "Composição, foto, texto, cor de destaque, logo.", rows: 3 },
      { key: "caption", label: "Legenda", placeholder: "Hook + storytelling curto + CTA.", rows: 4 },
      { key: "cta", label: "CTA", placeholder: "Salva · Comenta · Compartilha · DM", rows: 1 },
      { key: "hashtags", label: "Hashtags", placeholder: "5-10 hashtags relevantes.", rows: 1 },
    ],
  },
  threads_linkedin: {
    id: "threads_linkedin",
    label: "Threads / LinkedIn (texto)",
    sections: [
      { key: "angle", label: "Tese / Opinião", placeholder: "Ponto de vista ousado, contraintuitivo ou específico.", rows: 2 },
      { key: "hook", label: "Primeira linha (hook)", placeholder: "Frase única que para o scroll. Máx 1 linha.", rows: 1 },
      { key: "script", label: "Corpo do texto", placeholder: "Parágrafos curtos. Quebra de linha entre ideias. Storytelling > listas.", rows: 8 },
      { key: "cta", label: "Encerramento + CTA", placeholder: "Pergunta para gerar comentário ou convite para repost.", rows: 2 },
      { key: "hashtags", label: "Hashtags (LinkedIn)", placeholder: "3-5 hashtags de nicho.", rows: 1 },
    ],
  },
  podcast: {
    id: "podcast",
    label: "Spotify (Podcast)",
    sections: [
      { key: "angle", label: "Tese do episódio", placeholder: "Pergunta central que o episódio responde.", rows: 2 },
      { key: "guests", label: "Convidados / Participantes", placeholder: "Nome, bio rápida, ponto de vista, perguntas-chave.", rows: 3 },
      { key: "script", label: "Roteiro / Blocos", placeholder: "Abertura · Bloco 1 · Bloco 2 · Bloco 3 · Encerramento · Patrocínio", rows: 10 },
      { key: "chapters", label: "Capítulos", placeholder: "00:00 Intro\n02:30 Tema 1\n...", rows: 4 },
      { key: "cta", label: "CTAs (intro + meio + fim)", placeholder: "Seguir · Avaliar 5 estrelas · Mandar pergunta · Link", rows: 2 },
      { key: "description", label: "Descrição do episódio", placeholder: "Resumo + tópicos + bio convidado + links.", rows: 5 },
      { key: "cover", label: "Capa do episódio", placeholder: "Foto, título, número do episódio.", rows: 2 },
    ],
  },
};

export function pickTemplate(platform: string, format?: string | null): BriefingTemplate {
  const f = (format || "").toLowerCase();
  const p = platform.toLowerCase();
  if (p === "youtube" && /long|video|longo/.test(f)) return BRIEFING_TEMPLATES.youtube_long;
  if (p === "youtube") return BRIEFING_TEMPLATES.reels; // Shorts
  if (p === "tiktok") return BRIEFING_TEMPLATES.reels;
  if (p === "spotify") return BRIEFING_TEMPLATES.podcast;
  if (p === "linkedin" || p === "threads") {
    if (/carrossel|carousel/.test(f)) return BRIEFING_TEMPLATES.carousel;
    return BRIEFING_TEMPLATES.threads_linkedin;
  }
  if (p === "pinterest") return BRIEFING_TEMPLATES.feed_static;
  if (p === "instagram") {
    if (/carrossel|carousel/.test(f)) return BRIEFING_TEMPLATES.carousel;
    if (/feed|foto|estatico|estático/.test(f)) return BRIEFING_TEMPLATES.feed_static;
    return BRIEFING_TEMPLATES.reels;
  }
  return BRIEFING_TEMPLATES.reels;
}

// Operational checklist per kanban stage.
export const STAGE_CHECKLISTS: Record<string, string[]> = {
  backlog: [
    "Pauta alinhada ao pilar do trimestre",
    "Ângulo único definido (não é repetição)",
    "Responsável atribuído",
    "Data tentativa de gravação no calendário",
  ],
  script: [
    "Hook escrito e validado (passa no teste 3s)",
    "Roteiro com começo, meio e fim",
    "CTA primário definido",
    "Referências visuais coletadas",
    "Aprovação do roteiro pelo talento",
  ],
  shooting: [
    "Locação e horário confirmados",
    "Figurino / ambiente preparado",
    "Equipamento testado (câmera, áudio, luz)",
    "Teleprompter / colas prontas",
    "Backup de gravação realizado",
  ],
  editing: [
    "Corte bruto montado",
    "B-roll e inserts aplicados",
    "Legendas / texto na tela inseridos",
    "Música e SFX no nível correto",
    "Color grading e tratamento de áudio",
    "Capa / thumbnail finalizada",
    "Render final na resolução correta por plataforma",
  ],
  approval: [
    "Vídeo final revisado pelo talento",
    "Legenda + CTA + hashtags aprovados",
    "Checagem de compliance (claims, marcas, depoimentos)",
    "Capa aprovada",
    "Ajustes finais aplicados",
  ],
  scheduled: [
    "Agendado na ferramenta de publicação",
    "Cross-posting configurado (Reels/Shorts/TikTok)",
    "Story de apoio agendado",
    "Equipe avisada sobre dia/hora",
    "Resposta-padrão para primeiros comentários preparada",
  ],
  published: [
    "Link da publicação salvo na pauta",
    "Engajamento nas primeiras 2h (responder comentários)",
    "Stories de reforço publicados",
    "Métricas coletadas em 48h e em 7d",
    "Aprendizados documentados na biblioteca",
  ],
};
