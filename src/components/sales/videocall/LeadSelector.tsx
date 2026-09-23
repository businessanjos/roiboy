import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Loader2, Search, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface LeadOption {
  id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  status: string | null;
}

interface Props {
  value: LeadOption | null;
  onChange: (lead: LeadOption | null) => void;
}

export function LeadSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("leads")
        .select("id, full_name, phone, company_name, status")
        .order("created_at", { ascending: false })
        .limit(50);
      const s = term.trim();
      if (s) {
        const like = `%${s}%`;
        query = query.or(
          `full_name.ilike.${like},company_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
        );
      }
      const { data } = await query;
      if (!cancelled) {
        setLeads((data as LeadOption[]) ?? []);
        setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, open]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="flex-1 justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {value ? value.full_name || "Lead sem nome" : "Buscar lead para vincular"}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="relative border-b">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nome, empresa ou telefone"
              className="pl-8 border-0 focus-visible:ring-0"
            />
          </div>
          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : leads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="p-1">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      onChange(lead);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-2 text-sm hover:bg-accent flex items-start gap-2",
                      value?.id === lead.id && "bg-accent"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        value?.id === lead.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {lead.full_name || "Sem nome"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[lead.company_name, lead.phone, lead.status]
                          .filter(Boolean)
                          .join(" · ") || "Lead"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          title="Desvincular lead"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
