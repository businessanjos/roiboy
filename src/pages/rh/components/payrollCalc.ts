import type { HRCollaborator } from "@/hooks/useHRCollaborators";

const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recalcula todos os totais derivados a partir dos componentes.
 * Não altera os componentes informados (encargos/benefícios individuais).
 * Usado tanto no formulário quanto na exportação para garantir consistência.
 */
export function recalcDerived<T extends Partial<HRCollaborator>>(c: T): T {
  const next: any = { ...c };
  const totalCharges =
    num(next.inss_employer) + num(next.inss_third_parties) + num(next.inss_gilrat) +
    num(next.fgts) + num(next.vacation_provision) + num(next.vacation_third) +
    num(next.thirteenth_provision);
  next.total_charges = r2(totalCharges);
  const totalBenefits =
    num(next.health_plan) + num(next.life_insurance) + num(next.meal_voucher) +
    num(next.transport_voucher) + num(next.home_office_allowance);
  next.total_benefits = r2(totalBenefits);
  const baseS = num(next.base_salary);
  next.total_salary = r2(baseS + num(next.commissions) + num(next.dsr_commissions));
  const monthly = baseS + totalCharges + totalBenefits + num(next.other_costs);
  next.total_cost = r2(baseS + totalCharges);
  next.monthly_total_cost = r2(monthly);
  next.annual_total_cost = r2(monthly * 12);
  next.cost_pct = baseS > 0 ? r2((totalCharges / baseS) * 100) : 0;
  return next;
}
