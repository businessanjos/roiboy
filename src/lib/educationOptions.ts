/**
 * Formações (cursos de graduação) padronizadas.
 * As favoritas (área da saúde) aparecem primeiro no seletor.
 */

export const FAVORITE_EDUCATION_OPTIONS: string[] = [
  "Medicina",
  "Enfermagem",
  "Fisioterapia",
  "Biomedicina",
  "Odontologia",
  "Farmácia",
  "Nutrição",
  "Estética e Cosmética",
  "Psicologia",
  "Educação Física",
  "Fonoaudiologia",
  "Terapia Ocupacional",
  "Medicina Veterinária",
];

export const OTHER_EDUCATION_OPTIONS: string[] = [
  "Administração",
  "Agronomia",
  "Arquitetura e Urbanismo",
  "Arquivologia",
  "Artes Visuais",
  "Biblioteconomia",
  "Ciência da Computação",
  "Ciências Biológicas",
  "Ciências Contábeis",
  "Ciências Econômicas",
  "Ciências Sociais",
  "Cinema e Audiovisual",
  "Comércio Exterior",
  "Design",
  "Design de Moda",
  "Direito",
  "Engenharia Ambiental",
  "Engenharia Civil",
  "Engenharia de Alimentos",
  "Engenharia de Produção",
  "Engenharia de Software",
  "Engenharia Elétrica",
  "Engenharia Mecânica",
  "Engenharia Química",
  "Filosofia",
  "Física",
  "Geografia",
  "Gestão Comercial",
  "Gestão de Recursos Humanos",
  "História",
  "Hotelaria",
  "Jornalismo",
  "Letras",
  "Logística",
  "Marketing",
  "Matemática",
  "Medicina Nuclear",
  "Meteorologia",
  "Música",
  "Pedagogia",
  "Publicidade e Propaganda",
  "Química",
  "Quiropraxia",
  "Radiologia",
  "Relações Internacionais",
  "Relações Públicas",
  "Secretariado",
  "Serviço Social",
  "Sistemas de Informação",
  "Teatro",
  "Tecnologia da Informação",
  "Turismo",
  "Zootecnia",
  "Técnico em Enfermagem",
  "Técnico em Estética",
  "Técnico em Radiologia",
  "Outro",
];

export const ALL_EDUCATION_OPTIONS: string[] = [
  ...FAVORITE_EDUCATION_OPTIONS,
  ...OTHER_EDUCATION_OPTIONS,
];

const strip = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Mapeia textos livres antigos (profissão, erros de digitação) para a formação padrão. */
const ALIAS_MATCHERS: Array<{ test: RegExp; value: string }> = [
  { test: /biomedic|biomet(i|í)|bio-?medic/, value: "Biomedicina" },
  { test: /veterinar/, value: "Medicina Veterinária" },
  { test: /medic(o|a|ina)|m[ée]dic/, value: "Medicina" },
  { test: /enferm/, value: "Enfermagem" },
  { test: /fisi(o|io)?terap|fisiterap|fisioterp/, value: "Fisioterapia" },

  { test: /odonto|dentist|ondonto|oonto|osonto/, value: "Odontologia" },
  { test: /farmac|farmace/, value: "Farmácia" },
  { test: /nutri/, value: "Nutrição" },
  { test: /estetic|cosmetolog|cosmetic|micropigment|podolog|cabeleire|sobrancelh/, value: "Estética e Cosmética" },
  { test: /psicolog/, value: "Psicologia" },
  { test: /educa(c|ç)ao fisica|educador fisico/, value: "Educação Física" },
  { test: /fonoaudiol/, value: "Fonoaudiologia" },
  { test: /terapeuta ocupacional|terapia ocupacional/, value: "Terapia Ocupacional" },
  { test: /administra/, value: "Administração" },
  { test: /direito|advog/, value: "Direito" },
  { test: /arquitet/, value: "Arquitetura e Urbanismo" },
  { test: /agronom/, value: "Agronomia" },
  { test: /contab/, value: "Ciências Contábeis" },
  { test: /engenh/, value: "Engenharia de Produção" },
  { test: /comunica(c|ç)ao|publicidade|marketing/, value: "Marketing" },
  { test: /radiolog/, value: "Radiologia" },
  { test: /quiroprax/, value: "Quiropraxia" },
];

/**
 * Converte um valor livre para uma das opções padronizadas.
 * Retorna null quando não há correspondência confiável.
 */
export function normalizeEducation(raw?: string | null): string | null {
  if (!raw) return null;
  const value = strip(raw);
  if (!value) return null;

  const exact = ALL_EDUCATION_OPTIONS.find((o) => strip(o) === value);
  if (exact) return exact;

  for (const alias of ALIAS_MATCHERS) {
    if (alias.test.test(value)) return alias.value;
  }
  return null;
}
