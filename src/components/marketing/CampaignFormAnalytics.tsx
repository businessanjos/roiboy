import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Eye, MousePointerClick, CheckCircle2, Timer, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  form: { id: string; title: string; fields: string[] };
  onBack: () => void;
}

type Session = {
  id: string;
  landed_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_seconds: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  response_id: string | null;
};

type FieldEvent = {
  session_id: string;
  field_id: string;
  event: string;
  seconds_on_field: number | null;
};

type Response = {
  id: string;
  matched_lead_id: string | null;
  matched_deal_id: string | null;
};

const PERIODS = [
  { v: "7", l: "Últimos 7 dias" },
  { v: "30", l: "Últimos 30 dias" },
  { v: "90", l: "Últimos 90 dias" },
  { v: "all", l: "Tudo" },
];

export function CampaignFormAnalytics({ form, onBack }: Props) {
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<FieldEvent[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [fieldNames, setFieldNames] = useState<Record<string, string>>({});
  const [wonCount, setWonCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const sinceIso = period === "all" ? null : new Date(Date.now() - parseInt(period) * 86400000).toISOString();

      // Sessions
      let q = supabase.from("form_sessions").select("id, landed_at, started_at, completed_at, total_seconds, utm_source, utm_medium, utm_campaign, utm_content, response_id").eq("form_id", form.id);
      if (sinceIso) q = q.gte("landed_at", sinceIso);
      const { data: sess } = await q.order("landed_at", { ascending: false }).limit(5000);

      // Events
      let qe = supabase.from("form_field_events").select("session_id, field_id, event, seconds_on_field").eq("form_id", form.id);
      if (sinceIso) qe = qe.gte("at", sinceIso);
      const { data: ev } = await qe.limit(20000);

      // Responses with matched ids
      let qr = supabase.from("form_responses").select("id, matched_lead_id, matched_deal_id").eq("form_id", form.id);
      if (sinceIso) qr = qr.gte("submitted_at", sinceIso);
      const { data: rsp } = await qr.limit(5000);

      // Field names
      if (form.fields?.length) {
        const { data: cfs } = await supabase.from("custom_fields").select("id, name").in("id", form.fields);
        const map: Record<string, string> = {};
        (cfs || []).forEach((c: any) => { map[c.id] = c.name; });
        setFieldNames(map);
      }

      // Won deals among matched
      const dealIds = Array.from(new Set((rsp || []).map((r: any) => r.matched_deal_id).filter(Boolean)));
      const leadIds = Array.from(new Set((rsp || []).map((r: any) => r.matched_lead_id).filter(Boolean)));
      let won = 0;
      if (dealIds.length) {
        const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).in("id", dealIds).eq("status", "won");
        won += count || 0;
      }
      if (leadIds.length) {
        const { data: leadDeals } = await supabase.from("deals").select("id, status").in("lead_id", leadIds);
        won += (leadDeals || []).filter((d: any) => d.status === "won").length;
      }
      setWonCount(won);

      setSessions(sess || []);
      setEvents(ev || []);
      setResponses(rsp || []);
      setLoading(false);
    })();
  }, [form.id, period]);

  const funnel = useMemo(() => {
    const views = sessions.length;
    const starts = sessions.filter((s) => s.started_at).length;
    const completes = sessions.filter((s) => s.completed_at).length;
    return { views, starts, completes };
  }, [sessions]);

  const avgTotalSeconds = useMemo(() => {
    const completed = sessions.filter((s) => s.total_seconds && s.total_seconds > 0);
    if (!completed.length) return 0;
    return Math.round(completed.reduce((a, s) => a + (s.total_seconds || 0), 0) / completed.length);
  }, [sessions]);

  const utmBreakdown = useMemo(() => {
    const map = new Map<string, { source: string; campaign: string; views: number; completes: number }>();
    sessions.forEach((s) => {
      const key = `${s.utm_source || "(direct)"}|${s.utm_campaign || "—"}`;
      const e = map.get(key) || { source: s.utm_source || "(direct)", campaign: s.utm_campaign || "—", views: 0, completes: 0 };
      e.views += 1;
      if (s.completed_at) e.completes += 1;
      map.set(key, e);
    });
    return Array.from(map.values()).sort((a, b) => b.views - a.views).slice(0, 15);
  }, [sessions]);

  const fieldStats = useMemo(() => {
    // For each field: distinct sessions that focused, distinct that blurred without advancing (proxy: never reached next), avg seconds.
    const focusedPerField: Record<string, Set<string>> = {};
    const secondsPerField: Record<string, number[]> = {};
    events.forEach((e) => {
      if (e.event === "focus") {
        focusedPerField[e.field_id] = focusedPerField[e.field_id] || new Set();
        focusedPerField[e.field_id].add(e.session_id);
      }
      if (e.event === "blur" && e.seconds_on_field != null) {
        secondsPerField[e.field_id] = secondsPerField[e.field_id] || [];
        secondsPerField[e.field_id].push(e.seconds_on_field);
      }
    });
    // Abandono por campo: sessões que viram o campo mas NUNCA completaram
    const completedSessionIds = new Set(sessions.filter((s) => s.completed_at).map((s) => s.id));
    return (form.fields || []).map((fid, i) => {
      const seen = focusedPerField[fid] || new Set();
      const seenCount = seen.size;
      const abandoned = Array.from(seen).filter((sid) => !completedSessionIds.has(sid)).length;
      const secs = secondsPerField[fid] || [];
      const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0;
      const rate = seenCount ? Math.round((abandoned / seenCount) * 100) : 0;
      return {
        id: fid,
        name: fieldNames[fid] || `Campo ${i + 1}`,
        position: i + 1,
        seen: seenCount,
        abandoned,
        rate,
        avgSeconds: avg,
      };
    });
  }, [events, form.fields, sessions, fieldNames]);

  const matchedLeads = responses.filter((r) => r.matched_lead_id || r.matched_deal_id).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="w-4 h-4" />Voltar</Button>
          <div>
            <h2 className="text-lg font-semibold">{form.title}</h2>
            <p className="text-xs text-muted-foreground">Analytics do formulário</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Funnel */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard icon={<Eye className="w-4 h-4" />} label="Views" value={funnel.views} />
            <KpiCard icon={<MousePointerClick className="w-4 h-4" />} label="Iniciados" value={funnel.starts}
              hint={funnel.views ? `${Math.round((funnel.starts / funnel.views) * 100)}% conv.` : undefined} />
            <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Completos" value={funnel.completes}
              hint={funnel.starts ? `${Math.round((funnel.completes / funnel.starts) * 100)}% conclusão` : undefined} />
            <KpiCard icon={<Timer className="w-4 h-4" />} label="Tempo médio" value={`${avgTotalSeconds}s`} />
            <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Viraram venda" value={wonCount}
              hint={matchedLeads ? `${matchedLeads} matched` : undefined} />
          </div>

          {/* Abandono por campo */}
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Abandono por campo</h3>
              {fieldStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead className="text-right">Viram</TableHead>
                      <TableHead className="text-right">Abandonaram</TableHead>
                      <TableHead className="text-right">% abandono</TableHead>
                      <TableHead className="text-right">Tempo médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldStats.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-muted-foreground">{f.position}</TableCell>
                        <TableCell>{f.name}</TableCell>
                        <TableCell className="text-right">{f.seen}</TableCell>
                        <TableCell className="text-right">{f.abandoned}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={f.rate > 50 ? "destructive" : f.rate > 25 ? "secondary" : "outline"}>
                            {f.rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{f.avgSeconds}s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* UTM */}
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Origens (UTM)</h3>
              {utmBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Completos</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {utmBreakdown.map((u, i) => (
                      <TableRow key={i}>
                        <TableCell>{u.source}</TableCell>
                        <TableCell>{u.campaign}</TableCell>
                        <TableCell className="text-right">{u.views}</TableCell>
                        <TableCell className="text-right">{u.completes}</TableCell>
                        <TableCell className="text-right">{u.views ? Math.round((u.completes / u.views) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint?: string }) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
