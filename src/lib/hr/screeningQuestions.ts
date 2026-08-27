// Perguntas de triagem compartilhadas entre o formulário público e o drawer de seleção.
export type ScreeningQuestion = {
  id: string;
  label: string;
  helper?: string;
  type?: "textarea" | "text";
  required?: boolean;
  minLength?: number;
};

// Perguntas-padrão (usadas quando a vaga não define `screening_questions` próprias).
// Servem pra filtrar (só quem quer mesmo responde) e já traçar perfil.
export const DEFAULT_SCREENING_QUESTIONS: ScreeningQuestion[] = [
  {
    id: "why_you",
    label: "Por que VOCÊ, especificamente, deveria ocupar essa cadeira?",
    helper: "Sem clichês. Queremos entender o que te torna diferente, não o que você acha que queremos ouvir.",
    type: "textarea",
    required: true,
    minLength: 200,
  },
  {
    id: "owned_problem",
    label: "Conte uma situação real em que você assumiu um problema que não era seu e resolveu. O que aconteceu?",
    helper: "Contexto, sua ação concreta e o resultado mensurável (números, prazo, impacto).",
    type: "textarea",
    required: true,
    minLength: 200,
  },
  {
    id: "proudest_win",
    label: "Qual o maior orgulho profissional da sua carreira até hoje, e o que isso diz sobre você?",
    type: "textarea",
    required: true,
    minLength: 150,
  },
  {
    id: "why_eternum",
    label: "Por que a Eternum, e por que agora?",
    helper: "O que você já pesquisou sobre a gente? O que te conecta?",
    type: "textarea",
    required: true,
    minLength: 150,
  },
  {
    id: "deal_breaker",
    label: "O que faria você recusar essa vaga, mesmo gostando do desafio?",
    type: "textarea",
    required: true,
    minLength: 80,
  },
  {
    id: "salary",
    label: "Pretensão salarial (CLT, valor bruto mensal em R$)",
    type: "text",
    required: true,
  },
  {
    id: "start_date",
    label: "Em quanto tempo você consegue começar?",
    type: "text",
    required: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    helper: "URL completa do seu perfil.",
    type: "text",
    required: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    helper: "Quem você é fora do trabalho importa pra gente.",
    type: "text",
    required: false,
  },
];
