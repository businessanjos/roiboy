// O nome do funil é só um rótulo. As regras reconhecem o funil pelo papel fixo
// (pipelines.system_role), mantido pelo servidor; os nomes conhecidos ficam como reserva.
export type PipelineRole = "sdr" | "closer" | "low_ticket";

type PipelineLike = { name?: string | null; system_role?: string | null };

const LEGACY_NAMES: Record<PipelineRole, RegExp> = {
  sdr: /^sdr$/i,
  closer: /^(closer|funil mentoria)$/i,
  low_ticket: /^(tp - eternum pass|e-pass( \/ clinica ryka)?)$/i,
};

export function hasPipelineRole(pipeline: PipelineLike | null | undefined, role: PipelineRole): boolean {
  if (!pipeline) return false;
  if (pipeline.system_role) return pipeline.system_role === role;
  return LEGACY_NAMES[role].test((pipeline.name ?? "").trim());
}

export function findPipelineByRole<T extends PipelineLike>(pipelines: T[], role: PipelineRole): T | null {
  return pipelines.find(pipeline => pipeline.system_role === role)
    ?? pipelines.find(pipeline => hasPipelineRole(pipeline, role))
    ?? null;
}

export interface PipelineRenameImpact {
  charts: number;
  dashboards: number;
  system_role: string | null;
}

const ROLE_KEEPS: Record<PipelineRole, string> = {
  closer: "Continua recebendo os leads qualificados, as reuniões agendadas pelo SDR e os contratos digitais.",
  sdr: "Continua sendo o funil de pré-venda: \"Reunião Agendada\" segue levando o negócio ao funil de fechamento.",
  low_ticket: "Continua recebendo os leads abaixo da faixa de qualificação.",
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Texto do aviso mostrado antes de salvar um novo nome de funil. */
export function pipelineRenameNotice(oldName: string, impact: PipelineRenameImpact | null) {
  const keeps = ["Negócios, etapas e permissões continuam neste funil."];
  if (!impact) keeps.push("Os gráficos salvos que filtram por este funil passam a usar o nome novo sozinhos.");
  else if (impact.charts > 0) {
    keeps.push(`${plural(impact.charts, "gráfico salvo", "gráficos salvos")} em ${plural(impact.dashboards, "painel", "painéis")} ${impact.charts === 1 ? "passa" : "passam"} a usar o nome novo sozinhos.`);
  } else keeps.push("Nenhum gráfico salvo filtra por este funil hoje.");
  const role = impact?.system_role as PipelineRole | null | undefined;
  if (role && ROLE_KEEPS[role]) keeps.push(ROLE_KEEPS[role]);
  keeps.push(`Formulários e integrações que ainda enviarem "${oldName}" continuam chegando aqui.`);
  return {
    keeps,
    changes: [
      "Sistemas de fora que recebem o nome do funil, como a Central de Tráfego, passam a ver o nome novo.",
      "A troca fica registrada com seu nome, data e hora.",
    ],
  };
}
