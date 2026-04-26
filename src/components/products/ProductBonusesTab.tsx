import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ProductBonus {
  id: string;
  product_id: string;
  account_id: string;
  label: string;
  description: string | null;
  color: string;
  display_order: number;
  is_active: boolean;
}

const COLOR_OPTIONS = [
  { value: "green", label: "Verde", class: "bg-emerald-500" },
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "purple", label: "Roxo", class: "bg-violet-500" },
  { value: "yellow", label: "Amarelo", class: "bg-amber-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
  { value: "cyan", label: "Ciano", class: "bg-cyan-500" },
  { value: "gray", label: "Cinza", class: "bg-gray-500" },
];

interface Props {
  productId: string | null;
  accountId: string;
}

export function ProductBonusesTab({ productId, accountId }: Props) {
  const [bonuses, setBonuses] = useState<ProductBonus[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New bonus form
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("green");

  const fetchBonuses = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_bonuses")
        .select("*")
        .eq("product_id", productId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setBonuses((data || []) as ProductBonus[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar bônus");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBonuses();
  }, [productId]);

  const handleAdd = async () => {
    if (!productId) {
      toast.error("Salve o produto antes de adicionar bônus");
      return;
    }
    if (!newLabel.trim()) {
      toast.error("Dê um nome ao bônus");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("product_bonuses")
        .insert({
          account_id: accountId,
          product_id: productId,
          label: newLabel.trim(),
          description: newDescription.trim() || null,
          color: newColor,
          display_order: bonuses.length,
        })
        .select()
        .single();
      if (error) throw error;
      setBonuses((prev) => [...prev, data as ProductBonus]);
      setNewLabel("");
      setNewDescription("");
      setNewColor("green");
      toast.success("Bônus adicionado!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao adicionar bônus");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<ProductBonus>) => {
    try {
      const { error } = await supabase
        .from("product_bonuses")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar alteração");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este bônus?")) return;
    try {
      const { error } = await supabase.from("product_bonuses").delete().eq("id", id);
      if (error) throw error;
      setBonuses((prev) => prev.filter((b) => b.id !== id));
      toast.success("Bônus removido");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao excluir bônus");
    }
  };

  if (!productId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
        <Gift className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">
          Salve o produto primeiro para configurar os bônus inclusos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold mb-0">Adicionar bônus</Label>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Ex: 3 meses de Liberty IA com implementação"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Textarea
            placeholder="Descrição opcional (entrega, condições...)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewColor(opt.value)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    opt.class,
                    newColor === opt.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  title={opt.label}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Bônus deste produto ({bonuses.length})
        </Label>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : bonuses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum bônus cadastrado. Os vendedores não verão opções na hora de fechar.
          </div>
        ) : (
          <div className="space-y-2">
            {bonuses.map((b) => {
              const colorOpt = COLOR_OPTIONS.find((c) => c.value === b.color);
              return (
                <div
                  key={b.id}
                  className="group flex items-start gap-3 rounded-lg border p-3 hover:border-primary/40 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
                  <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", colorOpt?.class)} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={b.label}
                      onChange={(e) =>
                        setBonuses((prev) =>
                          prev.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== b.label) {
                          handleUpdate(b.id, { label: e.target.value.trim() });
                        }
                      }}
                      className="h-8 text-sm font-medium border-transparent hover:border-input focus:border-input px-2"
                    />
                    {(b.description || b.description === "") && (
                      <Textarea
                        value={b.description ?? ""}
                        onChange={(e) =>
                          setBonuses((prev) =>
                            prev.map((x) =>
                              x.id === b.id ? { ...x, description: e.target.value } : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          handleUpdate(b.id, { description: e.target.value.trim() || null })
                        }
                        placeholder="Adicionar descrição..."
                        rows={1}
                        className="text-xs border-transparent hover:border-input focus:border-input px-2 min-h-0 py-1 resize-none"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex gap-0.5">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleUpdate(b.id, { color: opt.value })}
                          className={cn(
                            "w-3 h-3 rounded-full transition-all",
                            opt.class,
                            b.color === opt.value
                              ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                              : "opacity-50 hover:opacity-100"
                          )}
                          title={opt.label}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
