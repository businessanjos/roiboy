import { THERMOMETER_DEFAULT } from "./pda";

export type PdaFilters = {
  sector: string;
  level: string;
  phase: string;
  thermo: string;
  company: string;
};

export const EMPTY_PDA_FILTERS: PdaFilters = {
  sector: "all",
  level: "all",
  phase: "all",
  thermo: "all",
  company: "all",
};

export function applyPdaFilters<T extends Record<string, any>>(rows: T[], f: PdaFilters): T[] {
  return rows.filter(c => {
    if (f.sector !== "all" && !((c.pda_sectors as string[]) || []).includes(f.sector)) return false;
    if (f.level !== "all" && c.pda_level !== f.level) return false;
    if (f.phase !== "all" && c.pda_phase !== f.phase) return false;
    if (f.thermo !== "all" && (c.pda_thermometer || THERMOMETER_DEFAULT) !== f.thermo) return false;
    if (f.company !== "all" && c.registration_company !== f.company) return false;
    return true;
  });
}

export const isPdaTerminated = (c: Record<string, any>) =>
  c.status === "inactive" || !!c.termination_date;
