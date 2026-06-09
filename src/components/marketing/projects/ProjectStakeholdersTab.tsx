import { useState } from "react";
import { useProjectStakeholders, type ProjectStakeholder } from "@/hooks/useMarketingProjects";
import { useTeamUsers } from "@/hooks/useTeamUsers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Trash2, Mail, Phone, Globe, Linkedin, Instagram, Sparkles,
  Pencil, ExternalLink, Loader2, Building2, RefreshCw, BookOpen,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function normalizeUrl(u?: string | null) {
  if (!u) return null;
  const t = u.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function ProjectStakeholdersTab({ projectId }: { projectId: string }) {
  const { items, add, update, remove } = useProjectStakeholders(projectId);
  const { data: users = [] } = useTeamUsers();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectStakeholder | null>(null);
  const [viewing, setViewing] = useState<ProjectStakeholder | null>(null);
  const [researching, setResearching] = useState<string | null>(null);

  const handleResearch = async (s: ProjectStakeholder) => {
    setResearching(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("research-stakeholder", {
        body: { stakeholderId: s.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Pesquisa de IA concluída");
    } catch (e: any) {
      toast.error(e.message || "Falha ao pesquisar");
    } finally {
      setResearching(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">{items.length} envolvidos no projeto</p>
          <p className="text-xs text-muted-foreground/70">Use a IA para pesquisar sites e recomendar como aproveitar cada stakeholder.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Adicionar
        </Button>
      </div>

      {items.length === 0 && (
        <div className="border border-dashed rounded-xl p-10 text-center text-sm text-muted-foreground">
          Nenhum stakeholder ainda. Adicione internos (equipe) ou externos (agências, parceiros, autores, palestrantes...).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((s) => {
          const displayName = s.type === "internal"
            ? users.find((u) => u.id === s.user_id)?.name || s.name || "Usuário"
            : s.name || s.company || "Stakeholder";
          const subtitle = [s.title, s.company].filter(Boolean).join(" · ");
          const isResearching = researching === s.id;
          return (
            <div key={s.id} className="border rounded-xl p-3 hover:shadow-sm transition-all bg-card group">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 rounded-lg">
                  {s.logo_url && <AvatarImage src={s.logo_url} alt={displayName} className="object-contain" />}
                  <AvatarFallback className="rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 font-semibold">
                    {initialsOf(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{displayName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {s.type === "internal" ? "Interno" : "Externo"}
                    </Badge>
                    {s.ai_researched_at && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-400/40 text-violet-600 dark:text-violet-400">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" /> IA
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{s.role}{subtitle ? ` — ${subtitle}` : ""}</div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {s.website && (
                      <a href={normalizeUrl(s.website)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border hover:bg-muted">
                        <Globe className="h-3 w-3" /> Site
                      </a>
                    )}
                    {s.linkedin_url && (
                      <a href={normalizeUrl(s.linkedin_url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border hover:bg-muted">
                        <Linkedin className="h-3 w-3" /> LinkedIn
                      </a>
                    )}
                    {s.instagram_url && (
                      <a href={normalizeUrl(s.instagram_url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border hover:bg-muted">
                        <Instagram className="h-3 w-3" /> IG
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border hover:bg-muted">
                        <Mail className="h-3 w-3" /> Email
                      </a>
                    )}
                    {s.phone && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </span>
                    )}
                  </div>

                  {s.ai_summary && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.ai_summary}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleResearch(s)}
                  disabled={isResearching}
                >
                  {isResearching ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pesquisando...</>
                  ) : s.ai_researched_at ? (
                    <><RefreshCw className="h-3 w-3 mr-1" /> Atualizar IA</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> Pesquisar com IA</>
                  )}
                </Button>
                <div className="flex gap-1">
                  {(s.ai_summary || s.ai_recommendations || s.bio) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewing(s)}>
                      <BookOpen className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(s); setFormOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Remover stakeholder?")) remove.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <StakeholderFormDialog
        key={editing?.id || "new"}
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        users={users}
        onSubmit={async (payload) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...payload });
          } else {
            await add.mutateAsync(payload);
          }
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    {viewing.logo_url && <AvatarImage src={viewing.logo_url} className="object-contain" />}
                    <AvatarFallback className="rounded-lg">{initialsOf(viewing.name || viewing.company)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div>{viewing.name || viewing.company}</div>
                    <div className="text-xs font-normal text-muted-foreground">{viewing.role}{viewing.company ? ` · ${viewing.company}` : ""}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="ai">
                <TabsList>
                  <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Inteligência</TabsTrigger>
                  <TabsTrigger value="notes">Notas</TabsTrigger>
                </TabsList>
                <TabsContent value="ai" className="space-y-4 mt-3">
                  {viewing.ai_summary && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Resumo</div>
                      <p className="text-sm whitespace-pre-wrap">{viewing.ai_summary}</p>
                    </div>
                  )}
                  {viewing.ai_recommendations && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Como usar neste projeto</div>
                      <p className="text-sm whitespace-pre-wrap">{viewing.ai_recommendations}</p>
                    </div>
                  )}
                  {Array.isArray(viewing.ai_sources) && viewing.ai_sources.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Fontes</div>
                      <ul className="text-xs space-y-1">
                        {viewing.ai_sources.map((src, i) => (
                          <li key={i}>
                            <a href={src.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> {src.title || src.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewing.ai_researched_at && (
                    <div className="text-[11px] text-muted-foreground">
                      Pesquisado em {format(parseISO(viewing.ai_researched_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  )}
                  {!viewing.ai_summary && !viewing.ai_recommendations && (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma pesquisa de IA ainda. Use o botão "Pesquisar com IA" no card.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="notes" className="mt-3">
                  <p className="text-sm whitespace-pre-wrap">{viewing.notes || viewing.bio || <span className="text-muted-foreground">Sem notas.</span>}</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StakeholderFormDialog({
  open, onOpenChange, editing, users, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ProjectStakeholder | null;
  users: Array<{ id: string; name: string }>;
  onSubmit: (payload: Partial<ProjectStakeholder>) => Promise<void> | void;
}) {
  const [type, setType] = useState<"internal" | "external">(editing?.type || "external");
  const [userId, setUserId] = useState(editing?.user_id || "");
  const [name, setName] = useState(editing?.name || "");
  const [role, setRole] = useState(editing?.role || "");
  const [company, setCompany] = useState(editing?.company || "");
  const [title, setTitle] = useState(editing?.title || "");
  const [website, setWebsite] = useState(editing?.website || "");
  const [linkedin, setLinkedin] = useState(editing?.linkedin_url || "");
  const [instagram, setInstagram] = useState(editing?.instagram_url || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);

  // initial values come from `editing`; parent passes a `key` so this remounts per record

  const handle = async () => {
    if (!role.trim()) { toast.error("Papel é obrigatório"); return; }
    if (type === "internal" && !userId) { toast.error("Selecione a pessoa"); return; }
    if (type === "external" && !name.trim() && !company.trim()) { toast.error("Informe nome ou empresa"); return; }
    setSaving(true);
    try {
      await onSubmit({
        type, role,
        user_id: type === "internal" ? userId : null,
        name: type === "external" ? (name || null) : null,
        company: company || null,
        title: title || null,
        website: normalizeUrl(website),
        linkedin_url: normalizeUrl(linkedin),
        instagram_url: normalizeUrl(instagram),
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar stakeholder" : "Adicionar stakeholder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={type === "internal" ? "default" : "outline"} onClick={() => setType("internal")}>Interno (equipe)</Button>
            <Button size="sm" variant={type === "external" ? "default" : "outline"} onClick={() => setType("external")}>
              <Building2 className="h-3.5 w-3.5 mr-1" /> Externo
            </Button>
          </div>

          {type === "internal" ? (
            <div>
              <Label>Pessoa</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pessoa ou marca" /></div>
              <div><Label>Empresa</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ex.: Eternum" /></div>
              <div><Label>Cargo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: CMO" /></div>
              <div><Label>Site</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="exemplo.com" /></div>
              <div><Label>LinkedIn</Label><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." /></div>
              <div><Label>Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/..." /></div>
              <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
          )}

          <div><Label>Papel no projeto *</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Sponsor, Designer, Editor, Produtor..." /></div>
          <div><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
