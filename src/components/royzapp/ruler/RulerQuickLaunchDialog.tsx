import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useZappRulers } from "@/hooks/useZappRulers";
import { ZappRulerEnrollDialog } from "./ZappRulerEnrollDialog";
import { ZappRulerTemplateDialog } from "./ZappRulerTemplateDialog";

interface RulerQuickLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId?: string | null;
}

interface DealOption {
  id: string;
  title: string;
  name: string;
  phone: string | null;
  clientId: string | null;
  leadId: string | null;
}

export function RulerQuickLaunchDialog({ open, onOpenChange, sectorId = "vendas" }: RulerQuickLaunchDialogProps) {
  const { currentUser } = useCurrentUser();
  const { templates, saveTemplate } = useZappRulers(sectorId);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DealOption[]>([]);
  const [selected, setSelected] = useState<DealOption | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !currentUser?.account_id) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("deals")
          .select(
            "id, title, contact_name, contact_phone, client_id, lead_id, client:clients(full_name, phone_e164), lead:leads(full_name, phone)",
          )
          .eq("account_id", currentUser.account_id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (search.trim()) {
          query = query.ilike("title", `%${search.trim()}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (cancelled) return;

        setOptions(
          (data || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            name: d.client?.full_name || d.lead?.full_name || d.contact_name || "Sem contato",
            phone: d.client?.phone_e164 || d.lead?.phone || d.contact_phone || null,
            clientId: d.client_id || null,
            leadId: d.lead_id || null,
          })),
        );
      } catch (err) {
        console.error("[RulerQuickLaunch] search failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search, currentUser?.account_id]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active && t.steps.length > 0),
    [templates],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Régua de relacionamento
            </DialogTitle>
            <DialogDescription>
              Escolha o negócio/lead que vai receber a régua ou crie um novo modelo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Modelos disponíveis</p>
                <p className="text-xs text-muted-foreground">
                  {activeTemplates.length} modelo(s) ativo(s) neste setor.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Novo modelo
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Para quem?</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar negócio ou lead pelo título..."
                  className="pl-8"
                />
              </div>

              <ScrollArea className="h-56 rounded-lg border">
                <div className="p-1">
                  {loading && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {!loading && options.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Nenhum negócio encontrado.
                    </p>
                  )}
                  {!loading &&
                    options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelected(o)}
                        className={cn(
                          "w-full text-left rounded-md px-3 py-2 hover:bg-muted transition-colors",
                          selected?.id === o.id && "bg-primary/10",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{o.title}</span>
                          {!o.phone && (
                            <Badge variant="outline" className="text-[10px]">
                              sem telefone
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.name}
                          {o.phone ? ` · ${o.phone}` : ""}
                        </p>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!selected || !selected.phone}
              onClick={() => setEnrollOpen(true)}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ZappRulerTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        template={null}
        onSave={saveTemplate}
      />

      <ZappRulerEnrollDialog
        open={enrollOpen}
        onOpenChange={(v) => {
          setEnrollOpen(v);
          if (!v) onOpenChange(false);
        }}
        templates={templates}
        sectorId={sectorId}
        contactName={selected?.name}
        contactPhone={selected?.phone}
        clientId={selected?.clientId}
        leadId={selected?.leadId}
      />
    </>
  );
}
