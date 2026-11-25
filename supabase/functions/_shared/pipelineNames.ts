// Nomes (padrões ILIKE, em ordem de preferência) dos funis usados no roteamento
// padrão de leads. Os funis já foram renomeados mais de uma vez; manter os nomes
// antigos e os atuais aqui evita que um lead fique sem negócio após uma troca.
export const MQL_PIPELINE_NAMES = ["Closer", "Funil Mentoria", "%Mentoria%", "%Closer%"];
export const NON_MQL_PIPELINE_NAMES = [
  "TP - Eternum Pass", "E-Pass / Clinica Ryka", "E-Pass", "%E-Pass%", "%Eternum Pass%",
];
