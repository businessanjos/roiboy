import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import { applyPdaFilters, EMPTY_PDA_FILTERS, isPdaTerminated, type PdaFilters } from "@/lib/rh/pdaFilters";
import CollaboratorsPDATable from "./CollaboratorsPDATable";
import PdaBoardView from "./PdaBoardView";
import PdaCalendarView from "./PdaCalendarView";
import PdaDashboardView from "./PdaDashboardView";

type View = "list" | "board" | "dashboard" | "calendar";

export default function CollaboratorsPDAWorkspace({
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
  const { optionsFor } = useHRPdaOptions();
  const [view, setView] = useState<View>("list");
  const [filters, setFilters] = useState<PdaFilters>(EMPTY_PDA_FILTERS);

  const setFilter = (key: keyof PdaFilters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => applyPdaFilters(collaborators, filters), [collaborators, filters]);
  const dashboardRows = useMemo(() => filtered.filter(c => !isPdaTerminated(c)), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={v => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="board">Quadro</TabsTrigger>
            <TabsTrigger value="dashboard">Painel</TabsTrigger>
            <TabsTrigger value="calendar">Calendário</TabsTrigger>
          </TabsList>
        </Tabs>

        {view !== "calendar" && (
          <>
            <Select value={filters.sector} onValueChange={v => setFilter("sector", v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {optionsFor("pda_sectors").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.level} onValueChange={v => setFilter("level", v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {optionsFor("pda_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.phase} onValueChange={v => setFilter("phase", v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fases</SelectItem>
                {optionsFor("pda_phase").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.thermo} onValueChange={v => setFilter("thermo", v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Termômetro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {optionsFor("pda_thermometer").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {view === "dashboard" && (
              <Select value={filters.company} onValueChange={v => setFilter("company", v)}>
                <SelectTrigger className="w-[210px]"><SelectValue placeholder="Empresa de registro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {optionsFor("registration_company").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>

      {view === "list" && (
        <CollaboratorsPDATable
          collaborators={filtered}
          canSeeSalary={canSeeSalary}
          canEdit={canEdit}
          onChanged={onChanged}
          hideFilters
        />
      )}
      {view === "board" && <PdaBoardView collaborators={filtered} />}
      {view === "dashboard" && (
        <PdaDashboardView
          collaborators={dashboardRows}
          canSeeSalary={canSeeSalary}
          onSlice={(field, value) => {
            setFilter(field, value);
            setView("list");
          }}
        />
      )}
      {view === "calendar" && <PdaCalendarView collaborators={collaborators} />}
    </div>
  );
}
