import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, ChevronsUpDown, HelpCircle, SlidersHorizontal, Sparkles, Target, Wallet } from "lucide-react";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import {
  computeSynergyPct, formatTenure, mentalModelLabel, normalizeMentalModel, synergyFromPct,
  tenureMonths, THERMOMETER_DEFAULT, type PdaOption,
} from "@/lib/rh/pda";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import PdaOptionsDialog from "./PdaOptionsDialog";

interface Props {
  form: any;
  setField: (key: string, value: any) => void;
  collaboratorId?: string;
  accountId?: string | null;
  canSeeSalary?: boolean;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  if (!hint) return <Label>{children}</Label>;
  return (
    <div className="flex items-center gap-1.5">
      <Label>{children}</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px]">{hint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function OptionSelect({
  value, onChange, options, placeholder = "Selecione",
}: { value?: string | null; onChange: (v: string) => void; options: PdaOption[]; placeholder?: string }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function YesNoSelect({ value, onChange }: { value?: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <Select value={value == null ? "" : value ? "sim" : "nao"} onValueChange={(v) => onChange(v === "sim")}>
      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sim">SIM</SelectItem>
        <SelectItem value="nao">NÃO</SelectItem>
      </SelectContent>
    </Select>
  );
}

function MoneyInput({ value, onChange }: { value?: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  useEffect(() => {
    setText(value == null ? "" : String(value).replace(".", ","));
  }, [value]);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        className="pl-10"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d,.]/g, ""))}
        onBlur={() => {
          const n = parseFloat(text.replace(/\./g, "").replace(",", "."));
          onChange(Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
        }}
      />
    </div>
  );
}

export default function CollaboratorPDA({ form, setField, collaboratorId, accountId, canSeeSalary = true }: Props) {
  const { optionsFor } = useHRPdaOptions();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [managers, setManagers] = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);
  const sectors: string[] = Array.isArray(form.pda_sectors) ? form.pda_sectors : [];

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      const { data } = await supabase
        .from("hr_collaborators")
        .select("id, full_name, avatar_url")
        .eq("account_id", accountId)
        .order("full_name");
      setManagers((data || []).filter((m: any) => m.id !== collaboratorId) as any);
    })();
  }, [accountId, collaboratorId]);

  const synergyPct = useMemo(
    () => computeSynergyPct(form.pda_role_profile, form.pda_dominant_profile, form.pda_secondary_profile),
    [form.pda_role_profile, form.pda_dominant_profile, form.pda_secondary_profile],
  );
  const synergy = synergyFromPct(synergyPct);
  const months = tenureMonths(form.hire_date, form.termination_date);
  const manager = managers.find((m) => m.id === form.manager_id);

  const toggleSector = (s: string) => {
    const next = sectors.includes(s) ? sectors.filter((x) => x !== s) : [...sectors, s];
    setField("pda_sectors", next);
  };

  return (
    <div className="space-y-4">
      {/* Posição */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Posição</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setOptionsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Opções
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Empresa de registro</Label>
            <OptionSelect
              value={form.registration_company}
              onChange={(v) => setField("registration_company", v)}
              options={optionsFor("registration_company")}
            />
          </div>
          <div>
            <Label>Hierarquia</Label>
            <OptionSelect value={form.pda_hierarchy} onChange={(v) => setField("pda_hierarchy", v)} options={optionsFor("pda_hierarchy")} />
          </div>
          <div className="md:col-span-2">
            <Label>Setores</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal min-h-10 h-auto py-1.5">
                  <div className="flex flex-wrap gap-1 items-center">
                    {sectors.length === 0
                      ? <span className="text-muted-foreground">Selecione os setores</span>
                      : sectors.map((s) => <PdaBadge key={s} value={s} options={optionsFor("pda_sectors")} />)}
                  </div>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                <div className="space-y-1">
                  {optionsFor("pda_sectors").map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleSector(o.value)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox checked={sectors.includes(o.value)} className="pointer-events-none" tabIndex={-1} />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                      {o.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Nível</Label>
            <OptionSelect value={form.pda_level} onChange={(v) => setField("pda_level", v)} options={optionsFor("pda_level")} />
          </div>
          <div>
            <Label>Gestor</Label>
            <Select value={form.manager_id || ""} onValueChange={(v) => setField("manager_id", v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gestor">
                  {manager && (
                    <span className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={manager.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {manager.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {manager.full_name}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {m.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {m.full_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Escolaridade</Label>
            <OptionSelect value={form.pda_education} onChange={(v) => setField("pda_education", v)} options={optionsFor("pda_education")} />
          </div>
          <div>
            <Label>Tempo de casa</Label>
            <div className="h-10 flex items-center text-sm">
              {months == null ? <span className="text-muted-foreground">Informe a data de admissão</span> : (
                <span>{months} {months === 1 ? "mês" : "meses"} <span className="text-muted-foreground">({formatTenure(months)})</span></span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Perfil */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Perfil</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Perfil da vaga</Label>
            <OptionSelect value={form.pda_role_profile} onChange={(v) => setField("pda_role_profile", v)} options={optionsFor("pda_role_profile")} />
          </div>
          <div>
            <Label>Perfil dominante</Label>
            <OptionSelect value={form.pda_dominant_profile} onChange={(v) => setField("pda_dominant_profile", v)} options={optionsFor("pda_profile")} />
          </div>
          <div>
            <Label>Perfil secundário</Label>
            <OptionSelect value={form.pda_secondary_profile} onChange={(v) => setField("pda_secondary_profile", v)} options={optionsFor("pda_profile")} />
          </div>
          <div>
            <Label>Sinergia <span className="text-[10px] text-muted-foreground">(automático)</span></Label>
            <div className="h-10 flex items-center gap-2">
              <YesNoBadge value={synergy} />
              <span className="text-sm text-muted-foreground">{synergyPct == null ? "—" : `${synergyPct}%`}</span>
            </div>
          </div>
          <div>
            <Label>Temperamento</Label>
            <OptionSelect value={form.pda_temperament} onChange={(v) => setField("pda_temperament", v)} options={optionsFor("pda_temperament")} />
          </div>
          <div>
            <Label>Modelo mental</Label>
            <OptionSelect
              value={normalizeMentalModel(form.pda_mental_model)}
              onChange={(v) => setField("pda_mental_model", v)}
              options={optionsFor("pda_mental_model").map((o) => ({ ...o, label: mentalModelLabel(o.value, form.gender) || o.label }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Desenvolvimento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>PDI feito</Label>
            <YesNoSelect value={form.pda_pdi_done} onChange={(v) => setField("pda_pdi_done", v)} />
          </div>
          <div>
            <Label>PDI entregue</Label>
            <YesNoSelect value={form.pda_pdi_delivered} onChange={(v) => setField("pda_pdi_delivered", v)} />
          </div>
          <div>
            <FieldLabel hint="Estime o esforço referente ao PDI">Nível de esforço</FieldLabel>
            <OptionSelect value={form.pda_effort_level} onChange={(v) => setField("pda_effort_level", v)} options={optionsFor("pda_effort_level")} />
          </div>
          <div>
            <FieldLabel hint="Classificar a qualidade da mudança do Anjo em relação ao PDI proposto">
              QM - Qualidade da Mudança
            </FieldLabel>
            <OptionSelect value={form.pda_change_quality} onChange={(v) => setField("pda_change_quality", v)} options={optionsFor("pda_change_quality")} />
          </div>
          <div>
            <Label>Fase</Label>
            <OptionSelect value={form.pda_phase} onChange={(v) => setField("pda_phase", v)} options={optionsFor("pda_phase")} />
          </div>
          <div>
            <FieldLabel hint="Essa pessoa está mais próxima de:">Termômetro</FieldLabel>
            <OptionSelect value={form.pda_thermometer || THERMOMETER_DEFAULT} onChange={(v) => setField("pda_thermometer", v)} options={optionsFor("pda_thermometer")} />
          </div>
        </CardContent>
      </Card>

      {/* Remuneração */}
      {canSeeSalary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Remuneração</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Salário líquido</Label>
              <MoneyInput value={form.net_salary} onChange={(v) => setField("net_salary", v)} />
            </div>
            <div>
              <Label>Salário sem encargos</Label>
              <MoneyInput value={form.salary_without_charges} onChange={(v) => setField("salary_without_charges", v)} />
            </div>
            <div>
              <Label>Salário com encargos</Label>
              <MoneyInput value={form.salary_with_charges} onChange={(v) => setField("salary_with_charges", v)} />
            </div>
          </CardContent>
        </Card>
      )}

      <PdaOptionsDialog open={optionsOpen} onOpenChange={setOptionsOpen} />
    </div>
  );
}
