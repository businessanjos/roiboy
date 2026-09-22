import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import { computeSynergyPct, optionColor, synergyFromPct, THERMOMETER_DEFAULT } from "@/lib/rh/pda";
import { isPdaTerminated } from "@/lib/rh/pdaFilters";

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

export default function PdaBoardView({ collaborators }: { collaborators: HRCollaborator[] }) {
  const navigate = useNavigate();
  const { optionsFor } = useHRPdaOptions();
  const [showTerminated, setShowTerminated] = useState(false);

  const active = useMemo(() => collaborators.filter(c => !isPdaTerminated(c)), [collaborators]);
  const terminated = useMemo(() => collaborators.filter(isPdaTerminated), [collaborators]);

  const card = (c: HRCollaborator) => {
    const pct = computeSynergyPct(c.pda_role_profile, (c as any).pda_dominant_profile, (c as any).pda_secondary_profile);
    const syn = synergyFromPct(pct);
    const thermo = (c as any).pda_thermometer || THERMOMETER_DEFAULT;
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => navigate((c as any).__route || `/rh/collaborators/${c.id}`)}
        className="w-full text-left rounded-lg border bg-card p-3 hover:border-primary/50 hover:shadow-sm transition-all space-y-2"
      >
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={c.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(c.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{c.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{c.position || "—"}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {c.pda_level && (
            <PdaBadge label={c.pda_level} color={optionColor(optionsFor("pda_level"), c.pda_level)} />
          )}
          {((c as any).pda_sectors || []).map((s: string) => (
            <PdaBadge key={s} label={s} color={optionColor(optionsFor("pda_sectors"), s)} />
          ))}
          {(c as any).pda_dominant_profile && (
            <PdaBadge
              label={(c as any).pda_dominant_profile}
              color={optionColor(optionsFor("pda_profile"), (c as any).pda_dominant_profile)}
            />
          )}
          {(c as any).pda_secondary_profile && (
            <PdaBadge
              label={(c as any).pda_secondary_profile}
              color={optionColor(optionsFor("pda_profile"), (c as any).pda_secondary_profile)}
            />
          )}
          {syn != null && <YesNoBadge value={syn} />}
          <PdaBadge label={thermo} color={optionColor(optionsFor("pda_thermometer"), thermo)} />
        </div>
      </button>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ativos ({active.length})
        </div>
        <div className="space-y-2">
          {active.length === 0
            ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum colaborador ativo nesta visão.</div>
            : active.map(card)}
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowTerminated(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {showTerminated ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Desligados ({terminated.length})
        </button>
        {showTerminated && (
          <div className="space-y-2">
            {terminated.length === 0
              ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum desligado nesta visão.</div>
              : terminated.map(card)}
          </div>
        )}
      </div>
    </div>
  );
}
