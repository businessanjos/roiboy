import * as XLSX from "xlsx";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { recalcDerived } from "./payrollCalc";

const COLUMNS: { key: keyof HRCollaborator; label: string }[] = [
  { key: "full_name", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "email", label: "E-mail" },
  { key: "department", label: "Departamento" },
  { key: "position", label: "Cargo" },
  { key: "unit", label: "Unidade" },
  { key: "employment_type", label: "Vínculo" },
  { key: "status", label: "Status" },
  { key: "registration_company", label: "Empresa registro" },
  { key: "payroll_company", label: "Empresa folha" },
  { key: "cbo", label: "CBO" },
  { key: "work_model", label: "Modelo trabalho" },
  { key: "hire_date", label: "Admissão" },
  // Salário
  { key: "base_salary", label: "Salário base" },
  { key: "net_salary", label: "Salário líquido" },
  { key: "commissions", label: "Comissões" },
  { key: "dsr_commissions", label: "DSR comissões" },
  { key: "total_salary", label: "Total salário" },
  // Encargos
  { key: "inss_employer", label: "INSS Patronal" },
  { key: "inss_third_parties", label: "INSS Terceiros" },
  { key: "inss_gilrat", label: "INSS GILRAT" },
  { key: "fgts", label: "FGTS" },
  { key: "vacation_provision", label: "Provisão férias" },
  { key: "vacation_third", label: "1/3 férias" },
  { key: "thirteenth_provision", label: "Provisão 13º" },
  { key: "total_charges", label: "Total encargos" },
  // Benefícios
  { key: "health_plan", label: "Plano de saúde" },
  { key: "life_insurance", label: "Seguro de vida" },
  { key: "meal_voucher", label: "Vale refeição" },
  { key: "transport_voucher", label: "Vale transporte" },
  { key: "home_office_allowance", label: "Ajuda home office" },
  { key: "total_benefits", label: "Total benefícios" },
  // Custos
  { key: "other_costs", label: "Outros custos" },
  { key: "monthly_total_cost", label: "Custo mensal" },
  { key: "annual_total_cost", label: "Custo anual" },
  { key: "cost_pct", label: "% custo / salário" },
];

/**
 * Filtra colaboradores que não devem entrar em cálculos de folha.
 * - inactive (desligado): SEMPRE removido das exportações e cálculos.
 * - active, vacation (férias), leave (afastado): mantidos (continuam custando).
 * Aplicado independentemente dos filtros de tela.
 */
export function filterPayrollEligible(collabs: HRCollaborator[]): HRCollaborator[] {
  return collabs.filter(c => (c.status || "active") !== "inactive");
}

function buildRows(collabs: HRCollaborator[]) {
  return filterPayrollEligible(collabs).map(orig => {
    const c = recalcDerived(orig);
    const r: Record<string, any> = {};
    for (const col of COLUMNS) {
      const v = (c as any)[col.key];
      r[col.label] = v == null ? "" : v;
    }
    return r;
  });
}

function fileName(ext: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `folha-encargos-${stamp}.${ext}`;
}

export function exportPayrollXLSX(collabs: HRCollaborator[]) {
  const rows = buildRows(collabs);
  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map(c => c.label) });
  ws["!cols"] = COLUMNS.map(c => ({ wch: Math.max(12, c.label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha & Encargos");
  XLSX.writeFile(wb, fileName("xlsx"));
  return rows.length;
}

export function exportPayrollCSV(collabs: HRCollaborator[]) {
  const rows = buildRows(collabs);
  const headers = COLUMNS.map(c => c.label);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(";"),
    ...rows.map(r => headers.map(h => escape(r[h])).join(";")),
  ];
  // BOM para Excel ler UTF-8 corretamente
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName("csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
