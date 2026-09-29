import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ban, Eye, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CopyPermissionsButton } from "./CopyPermissionsDialog";
import { UserAccessHistory } from "./UserAccessHistory";
import {
  LEVEL_LABELS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type AccessScope,
} from "@/lib/access/permissionCatalog";

interface Profile { id: string; name: string; description: string | null }
interface Item { profile_id: string; module: string; sub_item: string; access_level: AccessLevel; scope: AccessScope }
type Matrix = Record<string, { access_level: AccessLevel; scope: AccessScope }>;

const key = (m: string, s: string) => `${m}:${s}`;

export function PermissionProfilesManager({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Profile | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["permission-profiles", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const db = supabase as any;
      const { data: profiles, error } = await db
        .from("permission_profiles").select("id, name, description").eq("account_id", accountId).order("name");
      if (error) throw error;
      const ids = (profiles ?? []).map((p: Profile) => p.id);
      const { data: items } = ids.length
        ? await db.from("permission_profile_items").select("profile_id, module, sub_item, access_level, scope").in("profile_id", ids)
        : { data: [] };
      const { data: members } = await db.from("user_permission_profiles").select("profile_id").eq("account_id", accountId);
      return { profiles: (profiles ?? []) as Profile[], items: (items ?? []) as Item[], members: (members ?? []) as { profile_id: string }[] };
    },
  });

  const remove = async (p: Profile) => {
    if (!confirm(`Excluir o perfil "${p.name}"? As pessoas nele ficam sem perfil.`)) return;
    const { error } = await (supabase as any).from("permission_profiles").delete().eq("id", p.id);
    if (error) return toast.error("Não foi possível excluir.");
    toast.success("Perfil excluído");
    qc.invalidateQueries({ queryKey: ["permission-profiles", accountId] });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Perfis de Permissão
          </CardTitle>
          <CardDescription>Crie perfis e defina, por módulo, o que cada pessoa pode ver ou editar.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-1" /> Novo perfil</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !data?.profiles.length ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil criado ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.profiles.map((p) => {
              const its = data.items.filter((i) => i.profile_id === p.id);
              const counts = {
                manage: its.filter((i) => i.access_level === "manage").length,
                view: its.filter((i) => i.access_level === "view").length,
              };
              const total = PERMISSION_CATALOG.reduce((a, m) => a + m.items.length, 0);
              const none = total - counts.manage - counts.view;
              const people = data.members.filter((m) => m.profile_id === p.id).length;
              return (
                <div key={p.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{people} pessoa(s)</p>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Excluir" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {counts.manage > 0 && <Badge variant="secondary" className="gap-1"><Pencil className="h-3 w-3" />{counts.manage} editar</Badge>}
                    {counts.view > 0 && <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{counts.view} visualizar</Badge>}
                    {none > 0 && <Badge variant="outline" className="gap-1"><Ban className="h-3 w-3" />{none} sem acesso</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      {editing && (
        <ProfileEditor
          accountId={accountId}
          profile={editing === "new" ? null : editing}
          items={editing === "new" ? [] : (data?.items ?? []).filter((i) => i.profile_id === (editing as Profile).id)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["permission-profiles", accountId] }); }}
        />
      )}
    </Card>
  );
}

function ProfileEditor({ accountId, profile, items, onClose, onSaved }: {
  accountId: string; profile: Profile | null; items: Item[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const initial = useMemo<Matrix>(() => {
    const m: Matrix = {};
    for (const mod of PERMISSION_CATALOG) for (const it of mod.items) {
      const found = items.find((i) => i.module === mod.module && i.sub_item === it.sub);
      m[key(mod.module, it.sub)] = { access_level: found?.access_level ?? "none", scope: found?.scope ?? "own" };
    }
    return m;
  }, [items]);
  const [matrix, setMatrix] = useState<Matrix>(initial);
  useEffect(() => setMatrix(initial), [initial]);

  const set = (k: string, patch: Partial<Matrix[string]>) => setMatrix((m) => ({ ...m, [k]: { ...m[k], ...patch } }));

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao perfil.");
    setSaving(true);
    const db = supabase as any;
    let id = profile?.id;
    if (id) {
      const { error } = await db.from("permission_profiles").update({ name: name.trim() }).eq("id", id);
      if (error) { setSaving(false); return toast.error("Não foi possível salvar."); }
    } else {
      const { data, error } = await db.from("permission_profiles").insert({ account_id: accountId, name: name.trim() }).select("id").single();
      if (error) { setSaving(false); return toast.error(error.code === "23505" ? "Já existe um perfil com esse nome." : "Não foi possível salvar."); }
      id = data.id;
    }
    const rows = Object.entries(matrix).map(([k, v]) => {
      const [module, sub_item] = k.split(":");
      return { profile_id: id, module, sub_item, access_level: v.access_level, scope: v.scope };
    });
    const { error } = await db.from("permission_profile_items").upsert(rows, { onConflict: "profile_id,module,sub_item" });
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar as permissões.");
    toast.success("Perfil salvo");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pr-8"><DialogTitle>{profile ? "Editar perfil" : "Novo perfil"}</DialogTitle></DialogHeader>
        <Input placeholder="Nome do perfil (ex.: Closer)" value={name} onChange={(e) => setName(e.target.value)} />
        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="space-y-5 py-2">
            {PERMISSION_CATALOG.map((mod) => (
              <div key={mod.module} className="space-y-2">
                <h4 className="text-sm font-semibold">{mod.label}</h4>
                {mod.items.map((it) => {
                  const k = key(mod.module, it.sub);
                  const v = matrix[k];
                  return (
                    <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <span className="text-sm min-w-0 flex-1">{it.label}</span>
                      <div className="flex gap-2 shrink-0">
                        {it.scoped && v.access_level !== "none" && (
                          <Select value={v.scope} onValueChange={(s) => set(k, { scope: s as AccessScope })}>
                            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="own">Só os próprios</SelectItem>
                              <SelectItem value="all">Toda a equipe</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={v.access_level} onValueChange={(l) => set(k, { access_level: l as AccessLevel })}>
                          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(LEVEL_LABELS) as AccessLevel[]).map((l) => (
                              <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar perfil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Seletor do perfil de uma pessoa (usado no detalhe do usuário). */
export function UserProfileSelector({ userId, accountId }: { userId: string; accountId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["user-permission-profile", accountId, userId],
    enabled: !!userId && !!accountId,
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: profiles }, { data: current }] = await Promise.all([
        db.from("permission_profiles").select("id, name").eq("account_id", accountId).order("name"),
        db.from("user_permission_profiles").select("profile_id").eq("user_id", userId).maybeSingle(),
      ]);
      return { profiles: (profiles ?? []) as { id: string; name: string }[], current: current?.profile_id as string | undefined };
    },
  });

  const change = async (value: string) => {
    const db = supabase as any;
    const { error } = value === "none"
      ? await db.from("user_permission_profiles").delete().eq("user_id", userId)
      : await db.from("user_permission_profiles").upsert({ user_id: userId, account_id: accountId, profile_id: value }, { onConflict: "user_id" });
    if (error) return toast.error("Não foi possível alterar o perfil.");
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["user-permission-profile", accountId, userId] });
    qc.invalidateQueries({ queryKey: ["permission-profiles", accountId] });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Perfil de permissão</h4>
      </div>
      <Select value={data?.current ?? "none"} onValueChange={change}>
        <SelectTrigger className="h-9 w-full sm:w-[260px]"><SelectValue placeholder="Sem perfil" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem perfil</SelectItem>
          {(data?.profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Permissões individuais da pessoa (sem precisar de perfil). "Padrão" = sem regra própria. */
export function UserPermissionsEditor({ userId, accountId }: { userId: string; accountId: string }) {
  const qc = useQueryClient();
  const qk = ["user-permission-overrides", accountId, userId];
  const { data: rows = [] } = useQuery({
    queryKey: qk,
    enabled: !!userId && !!accountId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_permission_overrides").select("module, sub_item, access_level, scope").eq("user_id", userId);
      return (data ?? []) as { module: string; sub_item: string; access_level: AccessLevel; scope: AccessScope }[];
    },
  });
  const find = (m: string, s: string) => rows.find((r) => r.module === m && r.sub_item === s);

  const save = async (module: string, sub_item: string, level: AccessLevel | "default", scope?: AccessScope) => {
    const db = supabase as any;
    const { error } = level === "default"
      ? await db.from("user_permission_overrides").delete().eq("user_id", userId).eq("module", module).eq("sub_item", sub_item)
      : await db.from("user_permission_overrides").upsert(
          { user_id: userId, account_id: accountId, module, sub_item, access_level: level, scope: scope ?? find(module, sub_item)?.scope ?? "own" },
          { onConflict: "user_id,module,sub_item" });
    if (error) return toast.error("Não foi possível salvar a permissão.");
    qc.invalidateQueries({ queryKey: qk });
    qc.invalidateQueries({ queryKey: ["user-profile-permissions"] });
    qc.invalidateQueries({ queryKey: ["user-access-history"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Permissões desta pessoa</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">"Padrão" mantém o acesso normal do cargo. Salva na hora.</p>
        </div>
        <CopyPermissionsButton userId={userId} accountId={accountId} />
      </div>
      {PERMISSION_CATALOG.map((mod) => (
        <div key={mod.module} className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{mod.label}</p>
          {mod.items.map((it) => {
            const cur = find(mod.module, it.sub);
            return (
              <div key={it.sub} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                <span className="text-sm min-w-0 flex-1">{it.label}</span>
                <div className="flex gap-2 shrink-0">
                  {it.scoped && cur && cur.access_level !== "none" && (
                    <Select value={cur.scope} onValueChange={(s) => save(mod.module, it.sub, cur.access_level, s as AccessScope)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own">Só os próprios</SelectItem>
                        <SelectItem value="all">Toda a equipe</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={cur?.access_level ?? "default"} onValueChange={(l) => save(mod.module, it.sub, l as AccessLevel | "default")}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão</SelectItem>
                      {(Object.keys(LEVEL_LABELS) as AccessLevel[]).map((l) => (
                        <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <UserPipelineAccessEditor userId={userId} accountId={accountId} />
      <UserAccessHistory userId={userId} accountId={accountId} />
    </div>
  );
}

type PipelineAccess = "none" | "own" | "all";

/** Acesso por funil: sem linha = "Só os dele" (funil novo já nasce assim). */
export function UserPipelineAccessEditor({ userId, accountId }: { userId: string; accountId: string }) {
  const qc = useQueryClient();
  const qk = ["user-pipeline-access", accountId, userId];
  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-for-permissions", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("pipelines").select("id, name, is_active")
        .eq("account_id", accountId).eq("is_active", true).order("created_at");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const { data: rows = [] } = useQuery({
    queryKey: qk,
    enabled: !!userId && !!accountId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_pipeline_access").select("pipeline_id, access").eq("user_id", userId);
      return (data ?? []) as { pipeline_id: string; access: PipelineAccess }[];
    },
  });

  const save = async (pipelineId: string, access: PipelineAccess) => {
    const db = supabase as any;
    const { error } = access === "own"
      ? await db.from("user_pipeline_access").delete().eq("user_id", userId).eq("pipeline_id", pipelineId)
      : await db.from("user_pipeline_access").upsert(
          { user_id: userId, account_id: accountId, pipeline_id: pipelineId, access, updated_at: new Date().toISOString() },
          { onConflict: "user_id,pipeline_id" });
    if (error) return toast.error("Não foi possível salvar o acesso ao funil.");
    qc.invalidateQueries({ queryKey: qk });
    qc.invalidateQueries({ queryKey: ["my-pipeline-access"] });
    qc.invalidateQueries({ queryKey: ["user-access-history"] });
  };

  if (pipelines.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funis</p>
        <p className="text-xs leading-relaxed text-muted-foreground">Escolha em quais funis a pessoa entra e o que ela vê em cada um. Funil novo entra com "Só os dele".</p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {pipelines.map((p) => {
          const cur = rows.find((r) => r.pipeline_id === p.id)?.access ?? "own";
          const on = cur !== "none";
          return (
            <div key={p.id} className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${on ? "" : "bg-muted/40"}`}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Switch checked={on} onCheckedChange={(v) => save(p.id, v ? "own" : "none")} aria-label={`Acesso ao funil ${p.name}`} />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${on ? "text-foreground" : "text-muted-foreground"}`} title={p.name}>{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {!on ? "Sem acesso a este funil" : cur === "all" ? "Vê todos os negócios do funil" : "Vê só os negócios dele"}
                  </p>
                </div>
              </div>
              {on && (
                <div className="grid shrink-0 grid-cols-2 rounded-full bg-muted p-0.5 sm:w-[210px]">
                  {(["own", "all"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => cur !== opt && save(p.id, opt)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${cur === opt ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {opt === "own" ? "Só os dele" : "Todos do funil"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
