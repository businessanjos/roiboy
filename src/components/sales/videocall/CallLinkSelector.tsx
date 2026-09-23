import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Loader2, Search, Target, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type LinkKind = "deal" | "lead";

export interface LinkedRecord {
  kind: LinkKind;
  id: string;
  name: string;
  phone: string | null;
  subtitle: string | null;
  responsible_user_id: string | null;
}

function dealToRecord(d: Record<string, unknown>): LinkedRecord {
  return {
    kind: "deal",
    id: d.id as string,
    name: (d.contact_name as string) || (d.title as string) || "Negócio sem nome",
    phone: (d.contact_phone as string) ?? null,
    subtitle:
      [
        d.title as string,
        d.value
          ? Number(d.value).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            })
          : null,
        d.status as string,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    responsible_user_id: (d.responsible_user_id as string) ?? null,
  };
}

const DEAL_COLUMNS = "id, title, contact_name, contact_phone, status, value, responsible_user_id";

/** Busca o negócio já vinculado ou tenta casar por nome/telefone do participante. */
export async function findDealForCall(opts: {
  dealId?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<LinkedRecord | null> {
  if (opts.dealId) {
    const { data } = await supabase
      .from("deals")
      .select(DEAL_COLUMNS)
      .eq("id", opts.dealId)
      .maybeSingle();
    if (data) return dealToRecord(data as Record<string, unknown>);
  }

  const phone = (opts.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 8) {
    const tail = phone.slice(-8);
    const { data } = await supabase
      .from("deals")
      .select(DEAL_COLUMNS)
      .is("deleted_at", null)
      .ilike("contact_phone", `%${tail}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as Record<string, unknown>[])?.[0];
    if (row) return dealToRecord(row);
  }

  const name = (opts.name ?? "").trim();
  if (name.length >= 4) {
    const { data } = await supabase
      .from("deals")
      .select(DEAL_COLUMNS)
      .is("deleted_at", null)
      .or(`contact_name.ilike.${name},title.ilike.%${name}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as Record<string, unknown>[])?.[0];
    if (row) return dealToRecord(row);
  }

  return null;
}

interface Props {
  value: LinkedRecord | null;
  onChange: (record: LinkedRecord | null) => void;
  /** Origem padrão da busca: o funil de negócios. */
  defaultKind?: LinkKind;
}

export function CallLinkSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const kind: LinkKind = "deal";
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LinkedRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const s = term.trim();
      const like = `%${s}%`;
      let records: LinkedRecord[] = [];

      if (kind === "deal") {
        let query = supabase
          .from("deals")
          .select("id, title, contact_name, contact_phone, status, value, responsible_user_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (s) {
          query = query.or(
            `title.ilike.${like},contact_name.ilike.${like},contact_phone.ilike.${like},contact_email.ilike.${like}`
          );
        }
        const { data } = await query;
        records = ((data as Record<string, unknown>[]) ?? []).map((d) => ({
          kind: "deal" as const,
          id: d.id as string,
          name: (d.contact_name as string) || (d.title as string) || "Negócio sem nome",
          phone: (d.contact_phone as string) ?? null,
          subtitle:
            [
              d.title as string,
              d.value
                ? Number(d.value).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })
                : null,
              d.status as string,
            ]
              .filter(Boolean)
              .join(" · ") || null,
          responsible_user_id: (d.responsible_user_id as string) ?? null,
        }));
      } else {
        let query = supabase
          .from("leads")
          .select("id, full_name, phone, company_name, status, responsible_user_id")
          .order("created_at", { ascending: false })
          .limit(50);
        if (s) {
          query = query.or(
            `full_name.ilike.${like},company_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
          );
        }
        const { data } = await query;
        records = ((data as Record<string, unknown>[]) ?? []).map((l) => ({
          kind: "lead" as const,
          id: l.id as string,
          name: (l.full_name as string) || "Lead sem nome",
          phone: (l.phone as string) ?? null,
          subtitle:
            [l.company_name as string, l.status as string].filter(Boolean).join(" · ") || null,
          responsible_user_id: (l.responsible_user_id as string) ?? null,
        }));
      }

      if (!cancelled) {
        setItems(records);
        setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, open, kind]);

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
              <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {value ? value.name : "Buscar no funil de negócios"}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            Funil de negócios
          </div>

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
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nada encontrado
              </div>
            ) : (
              <div className="p-1">
                {items.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-2 text-sm hover:bg-accent flex items-start gap-2",
                      value?.id === item.id && "bg-accent"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        value?.id === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle ?? (item.kind === "deal" ? "Negócio" : "Lead")}
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
          title="Desvincular"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
