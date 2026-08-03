export interface ChecklistItem {
  id: string;
  label: string;
  /** Item negativo: marcar significa reprovação. */
  negative?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  note?: string;
  items: ChecklistItem[];
  /**
   * Formatos em que a etapa vem ativada por padrão.
   * Sem a lista, a etapa vale para todos os formatos por padrão.
   * A configuração salva por conta sobrescreve este padrão.
   */
  formats?: string[];
}

export interface ChecklistStage {
  id: string;
  title: string;
  subtitle: string;
  sections: ChecklistSection[];
}

export const CHECKLIST_FORMATS = [
  'Reels',
  'Stories',
  'Carrossel',
  'Post',
  'Revista',
  'Outdoor',
  'Outro',
] as const;

export type ChecklistFormat = (typeof CHECKLIST_FORMATS)[number];

/** Formatos antigos salvos em checklists já criados. */
export const LEGACY_FORMAT_ALIASES: Record<string, string> = {
  'Carrossel - Assunto em alta': 'Carrossel',
  'Carrossel - Educativo': 'Carrossel',
  'Outdoor - Prova social': 'Outdoor',
};

export function normalizeFormat(format?: string | null): string | null {
  if (!format) return null;
  return LEGACY_FORMAT_ALIASES[format] ?? format;
}


export const CHECKLIST_STAGES: ChecklistStage[] = [
  {
    id: 'antes',
    title: 'Antes de criar',
    subtitle: 'Preencha antes de produzir. Uma falha crítica interrompe o processo.',
    sections: [
      {
        id: 'pilar',
        title: '1. Pilar ativado',
        note: 'Sem pilar claro: não produz.',
        items: [
          { id: 'pilar_educacao', label: 'Educação estratégica — marketing, gestão ou vendas' },
          { id: 'pilar_autoridade', label: 'Autoridade de mercado — posição de líder' },
          { id: 'pilar_prova', label: 'Prova social — restaurante cheio' },
          { id: 'pilar_consciencia', label: 'Elevação de consciência — qualificação do empresário da estética' },
        ],
      },
      {
        id: 'objetivo',
        title: '2. Objetivo do post',
        note: 'Sem objetivo definido: não produz.',
        items: [
          { id: 'obj_crescimento', label: 'Crescimento — alcance ou seguidores' },
          { id: 'obj_autoridade', label: 'Autoridade — educação estratégica, prova social ou qualificação' },
          { id: 'obj_conexao', label: 'Conexão — RECA, comunidade, dor ou desejo' },
        ],
      },
      {
        id: 'publico',
        title: '3. Filtro de público',
        note: 'Se iniciantes amarem demais, está básico.',
        items: [
          { id: 'pub_empresarios', label: 'Fala com empresários da estética' },
          { id: 'pub_iniciantes', label: 'Evita linguagem para iniciantes' },
          { id: 'pub_fatura', label: 'Aborda problemas de quem já fatura' },
          { id: 'pub_nivel', label: 'Eleva o nível da conversa' },
        ],
      },
      {
        id: 'posicao',
        title: '4. Filtro de posição',
        note: 'Uma resposta "não" exige ajuste.',
        items: [
          { id: 'pos_lider', label: 'Posiciona a Eternum como líder do topo' },
          { id: 'pos_consciencia', label: 'Eleva o nível de consciência' },
          { id: 'pos_tom', label: 'Evita tom professoral ou básico' },
          { id: 'pos_visao', label: 'Sustenta uma visão própria' },
        ],
      },
      {
        id: 'premium',
        title: '5. Percepção premium',
        note: 'Se parecer "perfil de marketing", reprova.',
        items: [
          { id: 'prem_alto_nivel', label: 'Alto nível' },
          { id: 'prem_estrategia', label: 'Estratégia' },
          { id: 'prem_seguranca', label: 'Segurança' },
          { id: 'prem_lideranca', label: 'Liderança de mercado' },
          { id: 'prem_educacao', label: 'Educação empresarial séria' },
          { id: 'prem_x_marketing', label: 'Perfil de marketing digital', negative: true },
          { id: 'prem_x_motivacional', label: 'Perfil motivacional', negative: true },
          { id: 'prem_x_educacional', label: 'Perfil educacional básico', negative: true },
          { id: 'prem_x_dicas', label: 'Perfil de dicas simples', negative: true },
        ],
      },
    ],
  },
  {
    id: 'qualidade',
    title: 'Qualidade do conteúdo',
    subtitle: 'O post precisa ser forte, premium e coerente com a narrativa Eternum.',
    sections: [
      {
        id: 'gancho',
        title: '6. Força do gancho',
        note: 'O lead MQL pararia para ler? Se "não sei", está fraco.',
        items: [
          { id: 'gan_crenca', label: 'Ataca uma crença do mercado' },
          { id: 'gan_bandeira', label: 'Levanta uma bandeira' },
          { id: 'gan_curiosidade', label: 'Gera curiosidade' },
          { id: 'gan_identificacao', label: 'Gera identificação com empresários' },
          { id: 'gan_preciso_ler', label: 'Cria sensação de "preciso ler"' },
          { id: 'gan_ambicao', label: 'Ativa ambição' },
          { id: 'gan_x_educativo', label: 'Gancho educativo óbvio', negative: true },
          { id: 'gan_x_tecnico', label: 'Gancho técnico', negative: true },
          { id: 'gan_x_comum', label: 'Gancho comum', negative: true },
        ],
      },
      {
        id: 'profundidade',
        title: '7. Profundidade',
        note: 'Precisa parecer conteúdo premium.',
        items: [
          { id: 'prof_estrategica', label: 'Camada estratégica' },
          { id: 'prof_emocional', label: 'Camada emocional' },
          { id: 'prof_posicao', label: 'Camada de posição' },
          { id: 'prof_filtro', label: 'Camada de filtro de público' },
          { id: 'prof_x_informativo', label: 'Só informativo', negative: true },
          { id: 'prof_x_aula', label: 'Aula gratuita de Instagram', negative: true },
          { id: 'prof_x_mentoria', label: 'Mentoria barata', negative: true },
        ],
      },
      {
        id: 'coerencia',
        title: '8. Coerência com os pilares',
        items: [
          { id: 'coe_educacao', label: 'Educação: marketing, vendas, gestão ou posição' },
          { id: 'coe_autoridade', label: 'Autoridade: opiniões fortes, bandeiras e visão de líder' },
          { id: 'coe_prova', label: 'Prova social: clientes, movimento e resultados' },
          { id: 'coe_consciencia', label: 'Consciência: mudança de mentalidade, confronto e direção' },
        ],
      },
      {
        id: 'estetica',
        title: '9. Estética',
        note: 'Isso parece uma marca que vende R$ 200 mil/ano? Se não, refaz.',
        items: [
          { id: 'est_high_ticket', label: 'Parece marca high ticket' },
          { id: 'est_minimalista', label: 'Minimalista' },
          { id: 'est_sofisticada', label: 'Sofisticada' },
          { id: 'est_limpa', label: 'Sem poluição visual' },
          { id: 'est_nao_20k', label: 'Não parece perfil de 20 mil seguidores' },
        ],
      },
      {
        id: 'desejo',
        title: '10. Ativação de desejo',
        note: 'Se não gera desejo, reprova.',
        items: [
          { id: 'des_proximidade', label: 'Faz querer estar mais perto' },
          { id: 'des_proximo_nivel', label: 'Faz desejar o próximo nível' },
          { id: 'des_pronta', label: 'Faz sentir que está pronta' },
          { id: 'des_sem_cta', label: 'Não depende de CTA agressivo' },
          { id: 'des_quero', label: 'Gera "quero aprender", "quero fazer parte" ou "estou ficando para trás"' },
        ],
      },
      {
        id: 'narrativa',
        title: '11. Narrativa Eternum',
        items: [
          { id: 'nar_atemporal', label: 'Atemporal' },
          { id: 'nar_forte', label: 'Forte' },
          { id: 'nar_elegante', label: 'Elegante' },
          { id: 'nar_confiante', label: 'Confiante' },
          { id: 'nar_segura', label: 'Segura' },
          { id: 'nar_x_ansiosa', label: 'Ansiosa', negative: true },
          { id: 'nar_x_barulhenta', label: 'Barulhenta', negative: true },
          { id: 'nar_x_desesperada', label: 'Desesperada', negative: true },
          { id: 'nar_x_popular', label: 'Popular demais', negative: true },
        ],
      },
      {
        id: 'reprovacao',
        title: 'Reprovação imediata',
        note: 'Qualquer item marcado reprova automaticamente.',
        items: [
          { id: 'rep_capa_fraca', label: 'Capa ou gancho fraco', negative: true },
          { id: 'rep_erro_escrita', label: 'Erro de escrita ou gramática', negative: true },
          { id: 'rep_foto', label: 'Foto que a Bruna não aprovaria / pessoa estranha', negative: true },
          { id: 'rep_linguagem', label: 'Linguagem básica ou técnica demais', negative: true },
          { id: 'rep_filtro', label: 'Falta de filtro, promessa pequena ou estética comum', negative: true },
          { id: 'rep_emojis', label: 'Emojis ou reticências em excesso', negative: true },
        ],
      },
    ],
  },
  {
    id: 'execucao',
    title: 'Execução por formato',
    subtitle: 'Preencha somente o formato que será publicado.',
    sections: [
      {
        id: 'carrossel_alta',
        title: 'Carrossel — assunto em alta',
        formats: ['Carrossel', 'Post'],
        items: [
          { id: 'cra_capa', label: 'Capa chamativa e bonita com pessoa ou marca famosa para o público' },
          { id: 'cra_gancho', label: 'Gancho forte' },
          { id: 'cra_elementos', label: 'Elementos que se comunicam com o título' },
          { id: 'cra_contexto', label: 'Contexto rápido na 2ª tela' },
          { id: 'cra_virada', label: 'Virada estratégica' },
          { id: 'cra_valor', label: 'Conteúdo conectado à estética e gerando valor' },
          { id: 'cra_alternancia', label: 'Alternância entre vídeos, fotos e fundo neutro' },
          { id: 'cra_telas', label: 'Tela dividida, tela cheia, antes e depois ou comparativo' },
          { id: 'cra_legenda', label: 'Legenda contextualizada e não muito extensa' },
          { id: 'cra_cta', label: 'CTA com desejo, contexto do post e imagens do método' },
          { id: 'cra_semana', label: 'Publicação na 1ª ou 2ª semana do assunto em alta' },
          { id: 'cra_musica', label: 'Música em alta no tom do post' },
          { id: 'cra_colab', label: 'Colab EC' },
          { id: 'cra_fonte', label: 'Fonte e tamanho da letra conferidos' },
          { id: 'cra_gramatica', label: 'Sem erros de escrita ou gramática' },
          { id: 'cra_emojis', label: 'Sem excesso de emojis e reticências' },
        ],
      },
      {
        id: 'carrossel_edu',
        title: 'Carrossel — educativo',
        formats: ['Carrossel', 'Post'],
        items: [
          { id: 'cre_capa', label: 'Capa com gancho contraintuitivo ou forte' },
          { id: 'cre_estrategico', label: 'Nível estratégico' },
          { id: 'cre_dor', label: 'Toca em uma dor ou representa o que o público gostaria de dizer' },
          { id: 'cre_nao_obvio', label: 'Não óbvio' },
          { id: 'cre_nao_superficial', label: 'Não superficial' },
          { id: 'cre_imagens', label: 'Imagens familiares para o público' },
          { id: 'cre_profundidade', label: 'Conteúdo com profundidade de aula' },
          { id: 'cre_musica', label: 'Música em alta no tom do post' },
          { id: 'cre_cta', label: 'CTA contextualizado' },
          { id: 'cre_gramatica', label: 'Sem erros de escrita ou gramática' },
          { id: 'cre_emojis', label: 'Sem excesso de emojis' },
        ],
      },
      {
        id: 'revista',
        title: 'Revista',
        formats: ['Revista', 'Post'],
        items: [
          { id: 'rev_fomo', label: 'Gera FOMO' },
          { id: 'rev_identidade', label: 'Imagem dentro da identidade visual da Eternum' },
          { id: 'rev_validacao', label: 'Validação clara' },
          { id: 'rev_colab', label: 'Colab com cliente' },
          { id: 'rev_legenda', label: 'Legenda curta' },
        ],
      },
      {
        id: 'outdoor',
        title: 'Outdoor — prova social',
        formats: ['Outdoor', 'Post'],
        items: [
          { id: 'out_fomo', label: 'Gera FOMO' },
          { id: 'out_legenda', label: 'Legenda valoriza o EC e a pessoa' },
          { id: 'out_validacao', label: 'Validação clara' },
          { id: 'out_colab', label: 'Colab com cliente' },
          { id: 'out_nome', label: 'Nome da pessoa escrito corretamente' },
          { id: 'out_uso', label: 'Uso correto: topo da estética ou topo da medicina estética' },
        ],
      },
      {
        id: 'checagem_visual',
        title: 'Checagem visual final',
        note: 'Visual bonito não compensa conteúdo fraco. Conteúdo forte não compensa execução ruim.',
        items: [
          { id: 'cv_capa', label: 'Capa aprovada em tamanho de feed' },
          { id: 'cv_texto', label: 'Nenhum texto cortado ou pequeno demais' },
          { id: 'cv_qualidade', label: 'Fotos e vídeos em alta qualidade' },
          { id: 'cv_hierarquia', label: 'Hierarquia clara entre título, apoio e legenda' },
          { id: 'cv_identidade', label: 'Identidade visual consistente do início ao fim' },
        ],
      },
      {
        id: 'revisao_arquivo',
        title: 'Revisão do arquivo',
        items: [
          { id: 'ra_nome', label: 'Nome do arquivo correto' },
          { id: 'ra_ordem', label: 'Ordem das telas correta' },
          { id: 'ra_legenda', label: 'Legenda final revisada' },
          { id: 'ra_marcacoes', label: 'Marcações e colabs conferidas' },
          { id: 'ra_audio', label: 'Áudio correto selecionado' },
        ],
      },
    ],
  },
  {
    id: 'validacao',
    title: 'Validação final',
    subtitle: 'Última barreira antes de enviar para aprovação da Bruna.',
    sections: [
      {
        id: 'proibicoes',
        title: 'Proibições',
        note: 'Qualquer item marcado reprova automaticamente.',
        items: [
          { id: 'pro_basico', label: 'Conteúdo básico', negative: true },
          { id: 'pro_tecnico', label: 'Conteúdo técnico demais', negative: true },
          { id: 'pro_dicas', label: 'Dicas simples', negative: true },
          { id: 'pro_motivacional', label: 'Conteúdo motivacional', negative: true },
          { id: 'pro_sem_filtro', label: 'Conteúdo sem filtro de público', negative: true },
          { id: 'pro_sem_premium', label: 'Conteúdo sem percepção premium', negative: true },
        ],
      },
      {
        id: 'autoavaliacao',
        title: 'Autoavaliação do social',
        note: 'Se houver dúvida em qualquer resposta, não sobe.',
        items: [
          { id: 'auto_autoridade', label: 'Este post aumenta a autoridade da Eternum?' },
          { id: 'auto_atrai', label: 'Atrai empresários da estética?' },
          { id: 'auto_nivel', label: 'Eleva o nível do perfil?' },
          { id: 'auto_high_ticket', label: 'Parece uma marca high ticket?' },
          { id: 'auto_desejo', label: 'Gera desejo de proximidade e pertencimento?' },
          { id: 'auto_percepcao', label: 'Está à altura da percepção que queremos construir?' },
        ],
      },
      {
        id: 'revisao_sem_erro',
        title: 'Revisão sem erro',
        items: [
          { id: 'rse_voz_alta', label: 'Texto relido em voz alta' },
          { id: 'rse_ortografia', label: 'Ortografia e pontuação conferidas' },
          { id: 'rse_nomes', label: 'Nomes, cargos, números e marcas conferidos' },
          { id: 'rse_cta', label: 'CTA coerente com o conteúdo' },
          { id: 'rse_legenda', label: 'Legenda não repete o carrossel' },
          { id: 'rse_midia', label: 'Imagem, áudio e colab conferidos' },
        ],
      },
    ],
  },
];

export const PILAR_OPTIONS = [
  'Educação estratégica',
  'Autoridade de mercado',
  'Prova social',
  'Elevação de consciência',
];

export const OBJETIVO_OPTIONS = ['Crescimento', 'Autoridade', 'Conexão'];

export const DECISIONS = [
  { value: 'pending', label: 'Em preenchimento' },
  { value: 'approved', label: 'Aprovado para enviar à Bruna' },
  { value: 'adjust', label: 'Voltar para ajuste' },
  { value: 'rejected', label: 'Reprovado' },
] as const;

/** Mapa de override: `${formato}::${sectionId}` -> ativo/inativo. */
export type FormatRuleMap = Record<string, boolean>;

export const ruleKey = (format: string, sectionId: string) => `${format}::${sectionId}`;

/** Padrão do schema (sem considerar overrides). */
export function isSectionDefaultForFormat(section: ChecklistSection, format: string) {
  return !section.formats || section.formats.includes(format);
}

/** A etapa está ativa para o formato, considerando a configuração salva. */
export function isSectionEnabled(
  section: ChecklistSection,
  format?: string | null,
  rules?: FormatRuleMap,
) {
  const normalized = normalizeFormat(format);
  if (!normalized) return !section.formats;
  const override = rules?.[ruleKey(normalized, section.id)];
  if (override !== undefined) return override;
  return isSectionDefaultForFormat(section, normalized);
}

/** Retorna todas as seções visíveis para o formato escolhido. */
export function visibleSections(
  stage: ChecklistStage,
  format?: string | null,
  rules?: FormatRuleMap,
) {
  return stage.sections.filter((s) => isSectionEnabled(s, format, rules));
}

/** Todas as seções do checklist, achatadas com o título da etapa. */
export const ALL_SECTIONS = CHECKLIST_STAGES.flatMap((stage) =>
  stage.sections.map((section) => ({ stage, section })),
);

