import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Columns3, Eye, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import PdaOptionsDialog from "./PdaOptionsDialog";
import { ManagerCell, MoneyCell, MultiOptionCell, OptionCell, YesNoCell } from "./PdaEditableCell";
import {
  computeSynergyPct, formatMoney, formatTenure, synergyFromPct, tenureMonths, type PdaOption,
} from "@/lib/rh/pda";

interface RenderCtx {
  managerName?: string;
  managerAvatar?: string | null;
  opt: (key: any) => PdaOption[];
  people: { id: string; full_name: string; avatar_url?: string | null }[];
  save: (c: HRCollaborator, patch: Record<string, any>) => void;
  canEdit: boolean;
}

interface ColumnDef {
  key: string;
  label: string;
  align?: "right";
  render: (c: HRCollaborator, ctx: RenderCtx) => React.ReactNode;
}

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const optionCol = (key: string, label: string, fieldKey: string): ColumnDef => ({
  key,
  label,
  render: (c, ctx) => ctx.canEdit
    ? <OptionCell value={(c as any)[key]} options={ctx.opt(fieldKey)} onSave={(v) => ctx.save(c, { [key]: v })} />
    : <PdaBadge value={(c as any)[key]} options={ctx.opt(fieldKey)} />,
});

const yesNoCol = (key: string, label: string): ColumnDef => ({
  key,
  label,
  render: (c, ctx) => ctx.canEdit
    ? <YesNoCell value={(c as any)[key]} onSave={(v) => ctx.save(c, { [key]: v })} />
    : <YesNoBadge value={(c as any)[key]} />,
});

const moneyCol = (key: string, label: string): ColumnDef => ({
  key,
  label,
  align: "right",
  render: (c, ctx) => ctx.canEdit
    ? <MoneyCell value={(c as any)[key]} onSave={(v) => ctx.save(c, { [key]: v })} />
    : <>{formatMoney((c as any)[key])}</>,
});

const COLUMNS: ColumnDef[] = [
  { key: "bond", label: "Vínculo", render: c => <span className="whitespace-nowrap">{c.employment_type === "pj" ? "PJ" : c.employment_type === "intern" ? "Estágio" : c.employment_type === "socio" ? "Sócio" : c.employment_type ? c.employment_type.toUpperCase() : "—"}</span> },
  optionCol("registration_company", "Empresa de registro", "registration_company"),
  { key: "department", label: "Departamento", render: c => c.department || "—" },
  { key: "position", label: "Cargo", render: c => c.position || "—" },
  optionCol("pda_hierarchy", "Hierarquia", "pda_hierarchy"),
  {
    key: "pda_sectors", label: "Setores",
    render: (c, ctx) => ctx.canEdit
      ? <MultiOptionCell values={c.pda_sectors} options={ctx.opt("pda_sectors")} onSave={(v) => ctx.save(c, { pda_sectors: v })} />
      : (c.pda_sectors?.length
        ? <div className="flex flex-wrap gap-1">{c.pda_sectors.map(s => <PdaBadge key={s} value={s} options={ctx.opt("pda_sectors")} />)}</div>
        : "—"),
  },
  optionCol("pda_level", "Nível", "pda_level"),
  {
    key: "manager", label: "Gestor",
    render: (c, ctx) => ctx.canEdit
      ? <ManagerCell value={c.manager_id} people={ctx.people} onSave={(v) => ctx.save(c, { manager_id: v })} />
      : (ctx.managerName ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <Avatar className="h-6 w-6"><AvatarImage src={ctx.managerAvatar || undefined} /><AvatarFallback className="text-[9px]">{initials(ctx.managerName)}</AvatarFallback></Avatar>
          {ctx.managerName}
        </span>
      ) : "—"),
  },
  optionCol("pda_education", "Escolaridade", "pda_education"),
  { key: "tenure", label: "Tempo de casa", render: c => {
    const m = tenureMonths(c.hire_date, c.termination_date);
    return m == null ? "—" : `${m} m (${formatTenure(m)})`;
  } },
  optionCol("pda_role_profile", "Perfil da vaga", "pda_role_profile"),
  optionCol("pda_dominant_profile", "Dominante", "pda_profile"),
  optionCol("pda_secondary_profile", "Secundário", "pda_profile"),
  { key: "synergy", label: "Sinergia", render: c => <YesNoBadge value={synergyFromPct(computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile))} /> },
  { key: "synergy_pct", label: "% sinergia", align: "right", render: c => {
    const p = computeSynergyPct(c.pda_role_profile, c.pda_dominant_profile, c.pda_secondary_profile);
    return p == null ? "—" : `${p}%`;
  } },
  optionCol("pda_temperament", "Temperamento", "pda_temperament"),
  optionCol("pda_mental_model", "Modelo mental", "pda_mental_model"),
  yesNoCol("pda_pdi_done", "PDI feito"),
  yesNoCol("pda_pdi_delivered", "PDI entregue"),
  optionCol("pda_effort_level", "Nível de esforço", "pda_effort_level"),
  optionCol("pda_change_quality", "QM", "pda_change_quality"),
  optionCol("pda_phase", "Fase", "pda_phase"),
  optionCol("pda_thermometer", "Termômetro", "pda_thermometer"),
  moneyCol("net_salary", "Salário líquido"),
  moneyCol("salary_without_charges", "Sem encargos"),
  moneyCol("salary_with_charges", "Com encargos"),
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
  canEdit = true,
  onChanged,
}: {
  collaborators: HRCollaborator[];
  canSeeSalary?: boolean;
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const { optionsFor } = useHRPdaOptions();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Record<string, any>>>({});
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

  const data = useMemo(
    () => collaborators.map(c => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c)),
    [collaborators, overrides],
  );

  const nameById = useMemo(() => {
    const map: Record<string, HRCollaborator> = {};
    data.forEach(c => { map[c.id] = c; });
    return map;
  }, [data]);

  const people = useMemo(
    () => data.map(c => ({ id: c.id, full_name: c.full_name, avatar_url: c.avatar_url })),
    [data],
  );

  const save = async (c: HRCollaborator, patch: Record<string, any>) => {
    const table = ((c as any).__table || "hr_collaborators") as "hr_collaborators" | "hr_service_providers";
    setOverrides(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || {}), ...patch } }));
    const { error } = await supabase.from(table).update(patch as any).eq("id", c.id);
    if (error) {
      toast.error("Não foi possível salvar a alteração");
      setOverrides(prev => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      return;
    }
    onChanged?.();
  };

  const rows = useMemo(() => data.filter(c => {
    if (sectorFilter !== "all" && !(c.pda_sectors || []).includes(sectorFilter)) return false;
    if (levelFilter !== "all" && c.pda_level !== levelFilter) return false;
    if (phaseFilter !== "all" && c.pda_phase !== phaseFilter) return false;
    if (thermoFilter !== "all" && c.pda_thermometer !== thermoFilter) return false;
    return true;
  }), [data, sectorFilter, levelFilter, phaseFilter, thermoFilter]);

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
            {optionsFor("pda_sectors").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {optionsFor("pda_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {optionsFor("pda_phase").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={thermoFilter} onValueChange={setThermoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Termômetro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {optionsFor("pda_thermometer").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setOptionsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Opções
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
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
      </div>

      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Clique em qualquer célula colorida para alterar o valor — a mudança é salva na hora.
        </p>
      )}

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
              const ctx: RenderCtx = {
                managerName: mgr?.full_name,
                managerAvatar: mgr?.avatar_url,
                opt: optionsFor,
                people,
                save,
                canEdit,
              };
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top">
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

      <PdaOptionsDialog open={optionsOpen} onOpenChange={setOptionsOpen} />
    </div>
  );
}
