import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HeartHandshake, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHRBehaviorProfiles, type BehaviorProfileRow } from "@/hooks/useHRBehaviorProfiles";
import { optionColor, PDA_CHIP_TEXT, PROFILE_OPTIONS } from "@/lib/rh/pda";

export default function RHBehaviorProfiles() {
  const navigate = useNavigate();
  const { profiles, loading, save } = useHRBehaviorProfiles();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<BehaviorProfileRow | null>(null);
  const [newTip, setNewTip] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (p: BehaviorProfileRow) => {
    setEditingKey(p.profile_key);
    setDraft({ ...p, communication: [...p.communication] });
    setNewTip("");
  };

  const commit = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await save(draft);
    setSaving(false);
    if (ok) { setEditingKey(null); setDraft(null); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="p-2 rounded-xl bg-rose-500/10">
          <HeartHandshake className="h-6 w-6 text-rose-600" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Perfis comportamentais</h1>
          <p className="text-sm text-muted-foreground">Como lidar com cada perfil: motivação, comunicação, pontos fortes e o que trabalhar</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-4">
          {profiles.map(p => {
            const editing = editingKey === p.profile_key && draft;
            const view = editing ? draft! : p;
            return (
              <Card key={p.profile_key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge
                        className="border-0"
                        style={{ backgroundColor: optionColor(PROFILE_OPTIONS, p.profile_key), color: PDA_CHIP_TEXT }}
                      >
                        {p.profile_key}
                      </Badge>
                      {editing ? (
                        <Input
                          className="h-8 max-w-xs"
                          value={view.leadership_style}
                          onChange={(e) => setDraft(d => d && { ...d, leadership_style: e.target.value })}
                        />
                      ) : (
                        <span className="text-muted-foreground font-normal">{p.leadership_style}</span>
                      )}
                    </CardTitle>
                    {editing ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingKey(null); setDraft(null); }}>Cancelar</Button>
                        <Button size="sm" onClick={commit} disabled={saving}>
                          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <Label>Motivação</Label>
                    {editing ? (
                      <Textarea rows={2} value={view.motivation} onChange={(e) => setDraft(d => d && { ...d, motivation: e.target.value })} />
                    ) : (
                      <p className="text-muted-foreground">{p.motivation}</p>
                    )}
                  </div>

                  <div>
                    <Label>Como se comunicar</Label>
                    {editing ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {view.communication.map((c, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {c}
                              <button onClick={() => setDraft(d => d && { ...d, communication: d.communication.filter((_, j) => j !== i) })}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input value={newTip} onChange={(e) => setNewTip(e.target.value)} placeholder="Nova orientação" />
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (!newTip.trim()) return;
                              setDraft(d => d && { ...d, communication: [...d.communication, newTip.trim()] });
                              setNewTip("");
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {p.communication.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    )}
                  </div>

                  <div>
                    <Label>Pontos fortes</Label>
                    {editing ? (
                      <Textarea rows={4} value={view.strengths} onChange={(e) => setDraft(d => d && { ...d, strengths: e.target.value })} />
                    ) : (
                      <p className="text-muted-foreground">{p.strengths}</p>
                    )}
                  </div>

                  <div>
                    <Label>O que precisa ser trabalhado</Label>
                    {editing ? (
                      <Textarea rows={4} value={view.improvements} onChange={(e) => setDraft(d => d && { ...d, improvements: e.target.value })} />
                    ) : (
                      <p className="text-muted-foreground">{p.improvements}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
