import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { isManagementUser } from "@/lib/access/managementRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, Plus, ChevronLeft, Calendar, CheckCircle2, Circle,
  Megaphone, Target, Heart, Wallet, ListChecks, FileText, Loader2, Trash2,
} from "lucide-react";
import { AreaKpiSnapshot } from "@/components/leader-meetings/AreaKpiSnapshot";

const AREAS = [
  { id: "marketing", label: "Marketing", icon: Megaphone, color: "text-purple-600 bg-purple-500/10" },
  { id: "comercial", label: "Comercial", icon: Target, color: "text-blue-600 bg-blue-500/10" },
  { id: "cs", label: "Customer Success", icon: Heart, color: "text-yellow-700 bg-yellow-700/10" },
  { id: "financeiro", label: "Financeiro", icon: Wallet, color: "text-emerald-600 bg-emerald-500/10" },
] as const;

type AreaId = typeof AREAS[number]["id"];

interface Meeting {
  id: string;
  meeting_date: string;
  title: string | null;
  status: string;
  general_notes: string | null;
  created_at: string;
}
interface Section {
  id: string; meeting_id: string; area: string;
  numbers: string | null; bottlenecks: string | null;
  blockers: string | null; next_steps: string | null;
}
interface Action {
  id: string; meeting_id: string; area: string | null;
  title: string; description: string | null;
  owner_user_id: string | null; due_date: string | null;
  status: string; completed_at: string | null;
}

export default function LeaderMeetings() {
  const { currentUser, loading } = useCurrentUser();
  const { isSuperAdmin } = useSuperAdmin();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDate, setNewDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [newTitle, setNewTitle] = useState("");

  const canAccess = useMemo(
    () => isManagementUser(currentUser, isSuperAdmin),
    [currentUser, isSuperAdmin]
  );

  const meetingsQuery = useQuery({
    queryKey: ["leader-meetings", currentUser?.account_id],
    enabled: !!currentUser?.account_id && canAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leader_meetings")
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("leader_meetings")
        .insert({
          account_id: currentUser!.account_id,
          meeting_date: newDate,
          title: newTitle || null,
          created_by: currentUser!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: (m) => {
      toast.success("Reunião criada");
      setCreating(false);
      setNewTitle("");
      setSelectedId(m.id);
      queryClient.invalidateQueries({ queryKey: ["leader-meetings"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar"),
  });

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canAccess) return <Navigate to="/setores" replace />;

  if (selectedId) {
    return (
      <MeetingDetail
        meetingId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Liderança Eternum
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">
            Reunião de Líderes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pauta semanal de números, gargalos e impeditivos por área.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova reunião
        </Button>
      </div>

      {meetingsQuery.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (meetingsQuery.data?.length || 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">Nenhuma reunião registrada ainda</p>
            <p className="text-sm mt-1">Crie a primeira para começar a acompanhar a pauta semanal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {meetingsQuery.data!.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              onClick={() => setSelectedId(m.id)}
            >
              <CardContent className="py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {format(parseISO(m.meeting_date), "EEEE, dd 'de' MMM yyyy", { locale: ptBR })}
                    </span>
                    <Badge variant={m.status === "finalizada" ? "default" : "secondary"}>
                      {m.status === "finalizada" ? "Finalizada" : "Rascunho"}
                    </Badge>
                  </div>
                  {m.title && (
                    <p className="text-sm text-muted-foreground mt-0.5">{m.title}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova reunião de líderes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Semana 25 - revisão de metas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Detail view -------------------- */

function MeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const meetingQuery = useQuery({
    queryKey: ["leader-meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leader_meetings")
        .select("*")
        .eq("id", meetingId)
        .single();
      if (error) throw error;
      return data as Meeting;
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ["leader-meeting-sections", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leader_meeting_sections")
        .select("*")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data as Section[];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["leader-meeting-actions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leader_meeting_actions")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Action[];
    },
  });

  const updateMeeting = useMutation({
    mutationFn: async (patch: Partial<Meeting>) => {
      const { error } = await supabase
        .from("leader_meetings")
        .update(patch)
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leader-meeting", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["leader-meetings"] });
    },
  });

  const m = meetingQuery.data;
  const sectionByArea = useMemo(() => {
    const map = new Map<string, Section>();
    (sectionsQuery.data || []).forEach((s) => map.set(s.area, s));
    return map;
  }, [sectionsQuery.data]);

  if (meetingQuery.isLoading || !m) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {format(parseISO(m.meeting_date), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
          </h1>
          {m.title && <p className="text-muted-foreground mt-1">{m.title}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={m.status === "finalizada" ? "default" : "secondary"}>
            {m.status === "finalizada" ? "Finalizada" : "Rascunho"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateMeeting.mutate({
                status: m.status === "finalizada" ? "draft" : "finalizada",
              })
            }
          >
            {m.status === "finalizada" ? "Reabrir" : "Finalizar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="marketing" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {AREAS.map((a) => (
            <TabsTrigger key={a.id} value={a.id} className="gap-2">
              <a.icon className="h-4 w-4" /> {a.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="actions" className="gap-2">
            <ListChecks className="h-4 w-4" /> Ações
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="h-4 w-4" /> Ata geral
          </TabsTrigger>
        </TabsList>

        {AREAS.map((a) => (
          <TabsContent key={a.id} value={a.id} className="mt-6 space-y-4">
            <AreaKpiSnapshot area={a.id} meetingDate={m.meeting_date} />
            <AreaSection
              meetingId={meetingId}
              area={a.id}
              label={a.label}
              icon={a.icon}
              colorClass={a.color}
              section={sectionByArea.get(a.id) || null}
            />
          </TabsContent>
        ))}

        <TabsContent value="actions" className="mt-6">
          <ActionsList
            meetingId={meetingId}
            actions={actionsQuery.data || []}
            accountId={currentUser?.account_id || ""}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ata geral</CardTitle>
            </CardHeader>
            <CardContent>
              <AutoSaveTextarea
                value={m.general_notes || ""}
                onSave={(v) => updateMeeting.mutate({ general_notes: v })}
                placeholder="Decisões, contexto, comentários gerais da reunião..."
                minHeight={240}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Area section -------------------- */

function AreaSection({
  meetingId, area, label, icon: Icon, colorClass, section,
}: {
  meetingId: string; area: string; label: string;
  icon: any; colorClass: string; section: Section | null;
}) {
  const queryClient = useQueryClient();

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Section>) => {
      const payload = { meeting_id: meetingId, area, ...patch };
      const { error } = await supabase
        .from("leader_meeting_sections")
        .upsert(payload, { onConflict: "meeting_id,area" });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["leader-meeting-sections", meetingId] }),
  });

  const fields: Array<{ key: keyof Section; label: string; placeholder: string }> = [
    { key: "numbers", label: "Números da semana", placeholder: "KPIs, metas, comparativos..." },
    { key: "bottlenecks", label: "Gargalos", placeholder: "O que está limitando o crescimento?" },
    { key: "blockers", label: "Impeditivos", placeholder: "Bloqueios que exigem decisão de outra área." },
    { key: "next_steps", label: "Próximos passos", placeholder: "Compromissos da área para a próxima semana." },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-5">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
            </Label>
            <AutoSaveTextarea
              value={(section?.[f.key] as string) || ""}
              onSave={(v) => upsert.mutate({ [f.key]: v } as any)}
              placeholder={f.placeholder}
              minHeight={140}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* -------------------- Actions -------------------- */

function ActionsList({
  meetingId, actions, accountId,
}: { meetingId: string; actions: Action[]; accountId: string }) {
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");

  const usersQuery = useQuery({
    queryKey: ["leader-meeting-users", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["leader-meeting-actions", meetingId] });

  const createAction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leader_meeting_actions").insert({
        meeting_id: meetingId,
        area: area || null,
        title,
        owner_user_id: ownerId || null,
        due_date: dueDate || null,
        created_by: currentUser?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação adicionada");
      setAdding(false);
      setTitle(""); setArea(""); setDueDate(""); setOwnerId("");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (a: Action) => {
      const next = a.status === "done" ? "open" : "done";
      const { error } = await supabase
        .from("leader_meeting_actions")
        .update({
          status: next,
          completed_at: next === "done" ? new Date().toISOString() : null,
        })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const removeAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leader_meeting_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    (usersQuery.data || []).forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersQuery.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ações & Follow-up</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Nova ação
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma ação registrada ainda.
          </p>
        ) : (
          actions.map((a) => {
            const areaInfo = AREAS.find((x) => x.id === a.area);
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <button
                  onClick={() => toggleStatus.mutate(a)}
                  className="mt-0.5 text-muted-foreground hover:text-primary"
                >
                  {a.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      a.status === "done" ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {a.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {areaInfo && (
                      <Badge variant="outline" className="text-[10px]">
                        {areaInfo.label}
                      </Badge>
                    )}
                    {a.owner_user_id && (
                      <span>👤 {usersById.get(a.owner_user_id) || "—"}</span>
                    )}
                    {a.due_date && (
                      <span>📅 {format(parseISO(a.due_date), "dd/MM/yyyy")}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAction.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>O que precisa ser feito?</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descrição curta" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {AREAS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(usersQuery.data || []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              onClick={() => createAction.mutate()}
              disabled={!title.trim() || createAction.isPending}
            >
              {createAction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- Autosave textarea -------------------- */

function AutoSaveTextarea({
  value, onSave, placeholder, minHeight = 120,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);

  // Sync external changes when not editing
  useMemo(() => {
    if (!dirty) setLocal(value);
  }, [value, dirty]);

  return (
    <Textarea
      value={local}
      placeholder={placeholder}
      style={{ minHeight }}
      onChange={(e) => {
        setLocal(e.target.value);
        setDirty(true);
      }}
      onBlur={() => {
        if (dirty && local !== value) {
          onSave(local);
        }
        setDirty(false);
      }}
    />
  );
}
