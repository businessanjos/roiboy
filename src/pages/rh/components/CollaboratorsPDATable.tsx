import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Columns3, Eye } from "lucide-react";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import {
  CHANGE_QUALITY_OPTIONS, EDUCATION_OPTIONS, EFFORT_OPTIONS, HIERARCHY_OPTIONS,
  LEVEL_OPTIONS, MENTAL_MODEL_OPTIONS, PHASE_OPTIONS, PROFILE_OPTIONS,
  REGISTRATION_COMPANY_OPTIONS, ROLE_PROFILE_OPTIONS, SECTOR_OPTIONS,
  TEMPERAMENT_OPTIONS, THERMOMETER_OPTIONS, computeSynergyPct, formatMoney,
  formatTenure, synergyFromPct, tenureMonths,
} from "@/lib/rh/pda";

interface ColumnDef {
  key: string;
  label: string;
  align?: "right";
  render: (c: HRCollaborator, ctx: { managerName?: string; managerAvatar?: string | null }) => React.ReactNode;
}

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const COLUMNS: ColumnDef[] = [
  { key: "bond", label: "Vínculo", render: c => <span className="whitespace-nowrap">{c.employment_type === "pj" ? "PJ" : c.employment_type === "intern" ? "Estágio" : c.employment_type === "socio" ? "Sócio" : c.employment_type ? c.employment_type.toUpperCase() : "—"}</span> },
  { key: "registration_company", label: "Empresa de registro", render: c => <PdaBadge value={c.registration_company} options={REGISTRATION_COMPANY_OPTIONS} /> },
  { key: "department", label: "Departamento", render: c => c.department || "—" },
  { key: "position", label: "Cargo", render: c => c.position || "—" },
  { key: "pda_hierarchy", label: "Hierarquia", render: c => <PdaBadge value={c.pda_hierarchy} options={HIERARCHY_OPTIONS} /> },
  {
    key: "pda_sectors", label: "Setores",
    render: c => (c.pda_sectors?.length
      ? <div className="flex flex-wrap gap-1">{c.pda_sectors.map(s => <PdaBadge key={s} value={s} options={SECTOR_OPTIONS} />)}</div>
      : "—"),
  },
  { key: "pda_level", label: "Nível", render: c => <PdaBadge value={c.pda_level} options={LEVEL_OPTIONS} /> },
  { key: "manager", label: "Gestor", render: (_c, ctx) => (ctx.managerName ? (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <Avatar className="h-6 w-6"><AvatarImage src={ctx.managerAvatar || undefined} /><AvatarFallback className="text-[9px]">{initials(ctx.managerName)}</AvatarFallback></Avatar>
      {ctx.managerName}
    </span>
  ) : "—") },
  { key: "pda_education", label: "Escolaridade", render: c => <PdaBadge value={c.pda_education} options={EDUCATION_OPTIONS} /> },
  { key: "tenure", label: "Tempo de casa", render: c => {
    const m = tenureMonths(c.hire_date, c.termination_date);
    return m == null ? "—" : `${m} m (${formatTenure(m)})`;
  } },
  { key: "pda_role_profile", label: "Perfil da vaga", render: c => <PdaBadge value={c.pda_role_profile} options={ROLE_PROFILE_OPTIONS} /> },
  { key: "pda_dominant_profile", label: "Dominante", render: c => <PdaBadge value={c.pda_dominant_profile} options={PROFILE_OPTIONS} /> },
  { key: "pda_secondary_profile", label: "Secundário", render: c => <PdaBadge value={c.pda_secondary_profile} options={PROFILE_OPTIONS} /> },
  { key: "synergy", label: "Sinergia", render: c => <YesNoBadge value={synergyFromPct(computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile))} /> },
  { key: "synergy_pct", label: "% sinergia", align: "right", render: c => {
    const p = computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile);
    return p == null ? "—" : `${p}%`;
  } },
  { key: "pda_temperament", label: "Temperamento", render: c => <PdaBadge value={c.pda_temperament} options={TEMPERAMENT_OPTIONS} /> },
  { key: "pda_mental_model", label: "Modelo mental", render: c => <PdaBadge value={c.pda_mental_model} options={MENTAL_MODEL_OPTIONS} /> },
  { key: "pda_pdi_done", label: "PDI feito", render: c => <YesNoBadge value={c.pda_pdi_done} /> },
  { key: "pda_pdi_delivered", label: "PDI entregue", render: c => <YesNoBadge value={c.pda_pdi_delivered} /> },
  { key: "pda_effort_level", label: "Nível de esforço", render: c => <PdaBadge value={c.pda_effort_level} options={EFFORT_OPTIONS} /> },
  { key: "pda_change_quality", label: "QM", render: c => <PdaBadge value={c.pda_change_quality} options={CHANGE_QUALITY_OPTIONS} /> },
  { key: "pda_phase", label: "Fase", render: c => <PdaBadge value={c.pda_phase} options={PHASE_OPTIONS} /> },
  { key: "pda_thermometer", label: "Termômetro", render: c => <PdaBadge value={c.pda_thermometer} options={THERMOMETER_OPTIONS} /> },
  { key: "net_salary", label: "Salário líquido", align: "right", render: c => formatMoney(c.net_salary) },
  { key: "salary_without_charges", label: "Sem encargos", align: "right", render: c => formatMoney(c.salary_without_charges) },
  { key: "salary_with_charges", label: "Com encargos", align: "right", render: c => formatMoney(c.salary_with_charges) },
];

const DEFAULT_VISIBLE = [
  "bond", "registration_company", "position", "pda_hierarchy", "pda_sectors", "pda_level",
  "manager", "tenure", "pda_dominant_profile", "synergy", "synergy_pct",
  "pda_phase", "pda_thermometer",
];

const STORAGE_KEY = "roy:rh:pda-columns";

export default function CollaboratorsPDATable({
  collaborators,
  canSeeSalary = true,
}: { collaborators: HRCollaborator[]; canSeeSalary?: boolean }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE;
  });
  const [sectorFilter, setSectorFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [thermoFilter, setThermoFilter] = useState("all");

  const nameById = useMemo(() => {
    const map: Record<string, HRCollaborator> = {};
    collaborators.forEach(c => { map[c.id] = c; });
    return map;
  }, [collaborators]);

  const rows = useMemo(() => collaborators.filter(c => {
    if (sectorFilter !== "all" && !(c.pda_sectors || []).includes(sectorFilter)) return false;
    if (levelFilter !== "all" && c.pda_level !== levelFilter) return false;
    if (phaseFilter !== "all" && c.pda_phase !== phaseFilter) return false;
    if (thermoFilter !== "all" && c.pda_thermometer !== thermoFilter) return false;
    return true;
  }), [collaborators, sectorFilter, levelFilter, phaseFilter, thermoFilter]);

  const columns = COLUMNS.filter(col =>
    visible.includes(col.key) &&
    (canSeeSalary || !["net_salary", "salary_without_charges", "salary_with_charges"].includes(col.key)),
  );

  const totals = useMemo(() => {
    const tenures = rows.map(c => tenureMonths(c.hire_date, c.termination_date)).filter((n): n is number => n != null);
    const syns = rows
      .map(c => computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile))
      .filter((n): n is number => n != null);
    const sum = (k: keyof HRCollaborator) => rows.reduce((s, c) => s + (Number(c[k]) || 0), 0);
    return {
      avgTenure: tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null,
      avgSynergy: syns.length ? Math.round(syns.reduce((a, b) => a + b, 0) / syns.length) : null,
      net: sum("net_salary"),
      without: sum("salary_without_charges"),
      with: sum("salary_with_charges"),
    };
  }, [rows]);

  const toggleColumn = (key: string) => {
    setVisible(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {LEVEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {PHASE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={thermoFilter} onValueChange={setThermoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Termômetro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {THERMOMETER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <Columns3 className="h-4 w-4 mr-2" /> Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2 max-h-[360px] overflow-y-auto">
            {COLUMNS.filter(col => canSeeSalary || !["net_salary", "salary_without_charges", "salary_with_charges"].includes(col.key)).map(col => (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleColumn(col.key)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={visible.includes(col.key)} className="pointer-events-none" tabIndex={-1} />
                {col.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/50">Colaborador</th>
              {columns.map(col => (
                <th key={col.key} className={`p-3 font-medium text-muted-foreground whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}>
                  {col.label}
                </th>
              ))}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="p-8 text-center text-muted-foreground">Nenhum colaborador nesta visão.</td></tr>
            ) : rows.map(c => {
              const mgr = c.manager_id ? nameById[c.manager_id] : undefined;
              const ctx = { managerName: mgr?.full_name, managerAvatar: mgr?.avatar_url };
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 sticky left-0 bg-background">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(c.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{c.full_name}</span>
                    </div>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className={`p-3 ${col.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {col.render(c, ctx)}
                    </td>
                  ))}
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => navigate((c as any).__route || `/rh/collaborators/${c.id}`)} title="Abrir ficha">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé de totais */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span><span className="text-muted-foreground">Pessoas:</span> <strong>{rows.length}</strong></span>
        <span><span className="text-muted-foreground">Tempo médio de casa:</span> <strong>{totals.avgTenure == null ? "—" : `${totals.avgTenure} meses (${formatTenure(totals.avgTenure)})`}</strong></span>
        <span><span className="text-muted-foreground">Sinergia média:</span> <strong>{totals.avgSynergy == null ? "—" : `${totals.avgSynergy}%`}</strong></span>
        {canSeeSalary && (
          <>
            <span><span className="text-muted-foreground">Líquido:</span> <strong>{formatMoney(totals.net)}</strong></span>
            <span><span className="text-muted-foreground">Sem encargos:</span> <strong>{formatMoney(totals.without)}</strong></span>
            <span><span className="text-muted-foreground">Com encargos:</span> <strong>{formatMoney(totals.with)}</strong></span>
          </>
        )}
      </div>
    </div>
  );
}
