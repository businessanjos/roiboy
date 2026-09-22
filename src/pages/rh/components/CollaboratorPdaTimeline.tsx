import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle2, History, LogOut, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/rh/pda";

const FIELD_LABELS: Record<string, string> = {
  pda_hierarchy: "Hierarquia",
  pda_level: "Nível",
  pda_role_profile: "Perfil da vaga",
  pda_dominant_profile: "Perfil dominante",
  pda_secondary_profile: "Perfil secundário",
  pda_pdi_done: "PDI feito",
  pda_pdi_delivered: "PDI entregue",
  pda_effort_level: "Nível de esforço",
  pda_change_quality: "QM",
  pda_phase: "Fase",
  pda_temperament: "Temperamento",
  pda_mental_model: "Modelo mental",
  pda_thermometer: "Termômetro",
  pda_education: "Escolaridade",
  position: "Cargo",
  registration_company: "Empresa de registro",
  manager_id: "Gestor",
  status: "Situação",
  termination_date: "Data de desligamento",
};

type Item = {
  id: string;
  at: string;
  icon: "hire" | "change" | "checkin" | "exit";
  title: string;
  detail?: string;
};

const ICONS = { hire: UserPlus, change: History, checkin: CheckCircle2, exit: LogOut } as const;

export default function CollaboratorPdaTimeline({
  personId,
  hireDate,
  terminationDate,
}: {
  personId: string;
  hireDate?: string | null;
  terminationDate?: string | null;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [history, checkins, followups, cycles] = await Promise.all([
        supabase.from("hr_pda_field_history")
          .select("id, field_key, old_value, new_value, changed_by_name, created_at")
          .eq("person_id", personId).order("created_at", { ascending: false }).limit(200),
        supabase.from("hr_pda_checkins")
          .select("id, scheduled_at, title, status, notes")
          .eq("person_id", personId).order("scheduled_at", { ascending: false }).limit(100),
        supabase.from("hr_pda_followups")
          .select("id, followup_date, kind, angel_feedback, management_feedback, author_name")
          .eq("person_id", personId).order("followup_date", { ascending: false }).limit(100),
        supabase.from("hr_pda_cycles")
          .select("id, label, created_at, pdi_done, pdi_delivered, effort_level, change_quality")
          .eq("person_id", personId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (cancelled) return;

      /** Deixa legível o valor bruto guardado no histórico (booleanos, listas JSON, vazio). */
      const fmtValue = (v?: string | null) => {
        const raw = (v ?? "").trim();
        if (!raw || raw === "null") return "—";
        if (raw === "true") return "SIM";
        if (raw === "false") return "NÃO";
        if (raw.startsWith("[")) {
          try {
            const arr = JSON.parse(raw);
            return Array.isArray(arr) && arr.length ? arr.join(", ") : "—";
          } catch { /* mantém o texto original */ }
        }
        return raw;
      };

      const list: Item[] = [];
      if (hireDate) list.push({ id: "hire", at: hireDate, icon: "hire", title: "Admissão", detail: formatDateBR(hireDate) });
      if (terminationDate) list.push({ id: "exit", at: terminationDate, icon: "exit", title: "Desligamento", detail: formatDateBR(terminationDate) });
      (history.data || []).forEach(h => list.push({
        id: h.id,
        at: h.created_at,
        icon: "change",
        title: FIELD_LABELS[h.field_key] || h.field_key,
        detail: `${fmtValue(h.old_value)} → ${fmtValue(h.new_value)}${h.changed_by_name ? ` · por ${h.changed_by_name}` : ""}`,
      }));
      (checkins.data || []).forEach(k => list.push({
        id: k.id,
        at: k.scheduled_at,
        icon: "checkin",
        title: k.title || "Check-in do PDA",
        detail: [k.status, k.notes].filter(Boolean).join(" · ") || undefined,
      }));
      (followups.data || []).forEach((f: any) => list.push({
        id: `f-${f.id}`,
        at: `${f.followup_date}T12:00:00`,
        icon: "checkin",
        title: `Acompanhamento${f.kind ? ` · ${f.kind}` : ""}`,
        detail: [f.angel_feedback, f.management_feedback, f.author_name ? `por ${f.author_name}` : null].filter(Boolean).join(" · ") || undefined,
      }));
      (cycles.data || []).forEach((c: any) => list.push({
        id: `c-${c.id}`,
        at: c.created_at,
        icon: "change",
        title: `PDI ${c.label || ""}`.trim(),
        detail: [
          c.pdi_done == null ? null : `Feito: ${c.pdi_done ? "SIM" : "NÃO"}`,
          c.pdi_delivered == null ? null : `Entregue: ${c.pdi_delivered ? "SIM" : "NÃO"}`,
          c.effort_level ? `Esforço: ${c.effort_level}` : null,
          c.change_quality ? `QM: ${c.change_quality}` : null,
        ].filter(Boolean).join(" · ") || undefined,
      }));

      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [personId, hireDate, terminationDate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Linha do tempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda. As mudanças do PDA passam a aparecer aqui.</p>
        ) : (
          <ol className="relative border-l pl-5 space-y-4">
            {items.map(it => {
              const Icon = ICONS[it.icon];
              return (
                <li key={it.id} className="relative">
                  <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{it.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(it.at).toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                  {it.detail && <p className="text-xs text-muted-foreground mt-0.5">{it.detail}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
