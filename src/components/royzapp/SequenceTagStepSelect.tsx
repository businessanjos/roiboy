import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ZappTagLite { id: string; name: string; color: string }

const COLORS = ["#c9a227", "#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7c85"];

export function useZappTagsLite() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["zapp-tags-lite", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<ZappTagLite[]> => {
      const { data, error } = await supabase.from("zapp_tags").select("id, name, color")
        .eq("account_id", currentUser!.account_id).eq("is_active", true).order("display_order").order("name");
      if (error) throw error;
      return (data || []) as ZappTagLite[];
    },
  });
}

/** Etiqueta salva no ROY como selo legível (cor + nome), nunca só um ponto. */
export function ZappTagChip({ tag, className }: { tag: { name: string; color?: string | null }; className?: string }) {
  const c = tag.color || "#6b7c85";
  return (
    <span
      className={cn("inline-flex h-4 max-w-[9rem] items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium leading-none", className)}
      style={{ backgroundColor: `${c}1f`, borderColor: `${c}55`, color: c }}
      title={tag.name}
    >
      <Tag className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

export function SequenceTagStepSelect({ value, onChange, className }: { value?: string | null; onChange: (id: string) => void; className?: string }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const { data: tags = [] } = useZappTagsLite();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const selected = tags.find((t) => t.id === value);
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  const create = async () => {
    const name = search.trim();
    if (!name || !currentUser?.account_id) return;
    setCreating(true);
    const { data, error } = await supabase.from("zapp_tags")
      .insert({ account_id: currentUser.account_id, name, color, display_order: tags.length })
      .select("id").single();
    setCreating(false);
    if (error) { toast.error(error.message || "Erro ao criar etiqueta"); return; }
    await qc.invalidateQueries({ queryKey: ["zapp-tags-lite"] });
    onChange(data.id);
    toast.success(`Etiqueta "${name}" criada`);
    setSearch(""); setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="Etiqueta a aplicar" className={cn("h-9 justify-between font-normal", className)}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Etiquetar:</span>
            {selected ? <ZappTagChip tag={selected} className="h-5 text-xs" /> : <span className="text-muted-foreground">escolha ou crie</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input autoFocus placeholder="Buscar ou criar etiqueta" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 h-8" />
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {filtered.map((t) => (
            <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted">
              <ZappTagChip tag={t} className="h-5 text-xs" />
              {t.id === value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && !search.trim() && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma etiqueta ainda.</p>}
        </div>
        {search.trim() && !exact && (
          <div className="mt-2 space-y-2 border-t pt-2">
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setColor(c)}
                  className={cn("h-5 w-5 rounded-full ring-offset-1 ring-offset-background", color === c && "ring-2 ring-foreground")} style={{ backgroundColor: c }} />
              ))}
            </div>
            <Button size="sm" className="w-full" onClick={create} disabled={creating}>
              <Plus className="mr-1 h-4 w-4" /> Criar "{search.trim()}"
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
