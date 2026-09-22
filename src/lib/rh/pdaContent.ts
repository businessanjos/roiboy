/**
 * Conteúdo de referência do PDA (espelha o projeto "RH - PDA ANJOS" do Asana).
 * Serve de padrão quando ainda não há conteúdo salvo na conta.
 */

export type BehaviorProfile = {
  profile_key: string;
  leadership_style: string;
  motivation: string;
  communication: string[];
  strengths: string;
  improvements: string;
};

export const BEHAVIOR_PROFILE_DEFAULTS: BehaviorProfile[] = [
  {
    profile_key: "Executor",
    leadership_style: "Líder Competidor",
    motivation: "Motiva-se por desafios e resultados.",
    communication: [
      "Deixe-o ter a última palavra",
      "Se esforce para manter os objetivos dele",
      "Saiba negociar",
      "Enfatize eficiência",
      "Argumente através da razão",
      "Reconhecimento das ideias dele",
      "Tenha alternativas",
      "Demonstre organização",
      "Mostre a importância de saber ouvir",
      "Se quiser convencê-lo, demonstre os pontos falhos",
      "Mostre a ele que aprovar é dar a última palavra",
      "Enfoque o que ele irá ganhar e onde pode perder",
      "Sinalize onde ele pode falhar, focando seu objetivo",
      "Seja rápido nas suas palavras",
      "Dê suporte aos seus objetivos e metas",
      "Deixe-o descobrir coisas",
    ],
    strengths:
      "Tem muita determinação e é focado nos objetivos e prazos. Senso de urgência aguçado. Facilidade e naturalidade para comandar pessoas com posicionamento firme e assertivo. Ritmo acelerado para si e para a equipe. Exigentes, decidem rápido e de forma individual, questionadores, senso crítico apurado. Gostam de inovações e lidam bem com mudanças e pressão.",
    improvements:
      "Podem agir com agressividade ou intimidação para alcançar objetivos; concentram-se nas falhas do grupo e esquecem de reconhecer acertos; excesso de competitividade; podem impedir que liderados peçam orientação ou façam críticas construtivas; intolerância e insensibilidade às necessidades alheias; inflexíveis e fechados a opiniões.",
  },
  {
    profile_key: "Planejador",
    leadership_style: "Líder Conciliador",
    motivation: "Motiva-se por segurança.",
    communication: [
      "Saiba ouvir suas necessidades",
      "Esteja aberto para discussões",
      "Mostre que o limite da paciência está ligado ao objetivo",
      "Demonstre confiança",
      "Mostre a diferença entre realidade e fantasia",
      "Dê suporte aos sentimentos",
      "Não tenha pressa para apresentar algo",
      "Veja suas opiniões e sentimentos",
      "Dê garantias",
      "Conheça seu ritmo",
      "Demonstre que trabalha diminuindo os riscos",
      "Trabalhe com apoio",
      "Mostre interesse na pessoa",
      "Esteja preparado para voltar atrás",
    ],
    strengths:
      "Abertos às opiniões dos liderados, decisões compartilhadas; conciliadores, prestativos, pacientes para orientar e acompanhar; valorizam harmonia e trabalho em equipe; cativam com natureza acolhedora; bons ouvintes, empatia com dificuldades e sentimentos.",
    improvements:
      "Podem desestimular equipes dinâmicas; passivos, dificuldade de falar com firmeza e corrigir comportamentos; previsíveis e rotineiros; pouco ambiciosos, conservadores, acomodados; podem perder o controle de comportamentos abusivos e gerar sentimento de injustiça nos mais comprometidos.",
  },
  {
    profile_key: "Analítico",
    leadership_style: "Líder Criterioso",
    motivation: "Motiva-se por informações, regras e procedimentos.",
    communication: [
      "Mostre que feito é melhor que perfeito",
      "Demonstre alternativas",
      "Dê tempo para ele estudar",
      "Coloque tudo por escrito",
      "Acorde os prazos dando garantias e cumpra",
      "Construa confiança através de explicação",
      "Não forneça atalhos",
      "Dê garantias bem-sucedidas",
      "Evite estratégias sem planejamento",
      "Mostre que errar também é humano",
      "Seja racional e dê suporte com fatos",
      "Seja sistemático",
      "Liste vantagens e desvantagens",
    ],
    strengths:
      "Cautelosos, decidem com base em fatos e segurança; mais racionais que emocionais; disciplinados, criteriosos, focados no trabalho; específicos, cuidadosos, pensamento lógico e estruturado, capacidade analítica acima da média para projetos complexos; exigem o mesmo dos liderados, que passam a cuidar mais dos detalhes.",
    improvements:
      "Rígidos, metódicos, sérios, retraídos; imagem de líder distante e frio; focam nas falhas e não valorizam acertos; perfeccionistas, presos a regras e métodos; ritmo lento para si e para a equipe; tendência a controlar e impor seu jeito.",
  },
  {
    profile_key: "Comunicador",
    leadership_style: "Líder Facilitador",
    motivation: "Motiva-se por relacionamentos e aceitação social.",
    communication: [
      "Converse sobre as opiniões dele",
      "Crie ideias interessantes junto com ele",
      "Mostre seu ponto de vista",
      "Explore soluções alternativas",
      "Reflita a importância de se aprofundar",
      "Ajude-o a focar",
      "Sinalize para não abrir muitas frentes ao mesmo tempo",
      "Reflita a importância de terminar o que começou",
      "Registre o acordo",
      "Seja interessante e entusiasmado",
      "Concorde e resuma suas ações",
    ],
    strengths:
      "Motiva a equipe com dinamismo, otimismo e entusiasmo; valoriza o diálogo para aproximar o grupo e resolver ruídos; considera aspectos emocionais nas decisões; deixa ambientes positivos, promove atividades em grupo; extrovertidos, ótimos argumentadores, convencem e influenciam; intuitivos, lidam bem com imprevistos.",
    improvements:
      "Exageram nas brincadeiras; não gostam de analisar relatórios e indicadores; falta disciplina, planejamento e foco na execução; não focam em detalhes; falam muito e agem pouco; perdem a paciência com rotinas.",
  },
];

/** Tipos de acompanhamento (subtarefa "PDA" do Asana). */
export const FOLLOWUP_KINDS = ["30 dias", "60 dias", "90 dias", "Ciclo", "Pontual"];

/** Tipos de documento do PDA. */
export const PDA_DOC_TYPES = ["Relatório de perfil", "PDI", "Avaliação", "Outro"];

/** Perguntas do mapa de empatia (flexionadas pelo gênero na exibição). */
export const EMPATHY_QUESTIONS: { key: string; question: (p: Pronouns) => string }[] = [
  { key: "thinks", question: (p) => `O que ${p.ela} pensa e sente sobre ${p.ela}?` },
  { key: "hears", question: (p) => `O que ${p.ela} escuta sobre ${p.ela}?` },
  { key: "says", question: (p) => `O que ${p.ela} fala e faz (atitude em público, aparência, comportamento com outros)?` },
  { key: "sees", question: (p) => `O que ${p.ela} vê (ambientes, amigos, o que o mercado oferece)?` },
  { key: "pains", question: () => "Dor (medos, frustrações, obstáculos)" },
  { key: "gains", question: () => "Ganhos (desejos e necessidades, formas de medir sucesso)" },
];

export type Pronouns = { ela: string };

export function pronounsFor(gender?: string | null): Pronouns {
  const g = (gender || "").trim().toLowerCase();
  const female = g.startsWith("f") || g.startsWith("mulher");
  return { ela: female ? "ela" : "ele" };
}

/** Perfil da vaga herdado do cargo ("Primário/Secundário"). */
export function roleProfileFromPosition(
  primary?: string | null,
  secondary?: string | null,
): string | null {
  if (!primary) return null;
  return secondary ? `${primary}/${secondary}` : primary;
}
