import { computeSynergyPct, synergyFromPct, THERMOMETER_DEFAULT } from "./pda";

export type PdaFilters = {
  sector: string;
  level: string;
  phase: string;
  thermo: string;
  company: string;
  hierarchy: string;
  dominant: string;
  quality: string;
  synergy: string;
};

export const EMPTY_PDA_FILTERS: PdaFilters = {
  sector: "all",
  level: "all",
  phase: "all",
  thermo: "all",
  company: "all",
  hierarchy: "all",
  dominant: "all",
  quality: "all",
  synergy: "all",
};

export const hasActivePdaFilters = (f: PdaFilters) =>
  Object.values(f).some(v => v !== "all");

export function applyPdaFilters<T extends Record<string, any>>(rows: T[], f: PdaFilters): T[] {
  return rows.filter(c => {
    if (f.sector !== "all" && !((c.pda_sectors as string[]) || []).includes(f.sector)) return false;
    if (f.level !== "all" && c.pda_level !== f.level) return false;
    if (f.phase !== "all" && c.pda_phase !== f.phase) return false;
    if (f.thermo !== "all" && (c.pda_thermometer || THERMOMETER_DEFAULT) !== f.thermo) return false;
    if (f.company !== "all" && c.registration_company !== f.company) return false;
    if (f.hierarchy !== "all" && c.pda_hierarchy !== f.hierarchy) return false;
    if (f.dominant !== "all" && c.pda_dominant_profile !== f.dominant) return false;
    if (f.quality !== "all" && c.pda_change_quality !== f.quality) return false;
    if (f.synergy !== "all") {
      const s = synergyFromPct(computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile));
      if (f.synergy === "SIM" && s !== true) return false;
      if (f.synergy === "NAO" && s !== false) return false;
    }
    return true;
  });
}

export const isPdaTerminated = (c: Record<string, any>) =>
  c.status === "inactive" || !!c.termination_date;
