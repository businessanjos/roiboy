import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isHiddenTechnicalPerson } from "@/lib/peopleVisibility";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mqlFromRevenue } from "@/lib/sales/bulkDeals";
import {
  buildDealExtraRows,
  pickCreateDealFields,
  type CreateDealField,
} from "@/lib/sales/createDealExtras";

export interface CreateDealExtrasValue {
  /** Empty = whoever is creating the deal. */
  sellerId: string;
  fields: CreateDealField[];
  values: Record<string, unknown>;
}

export const emptyCreateDealExtras: CreateDealExtrasValue = { sellerId: "", fields: [], values: {} };

/** Writes the optional answers after the deal exists; a failure here never undoes the created deal. */
export async function saveCreateDealExtras(accountId: string, dealId: string, extras: CreateDealExtrasValue) {
  const rows = buildDealExtraRows(accountId, dealId, extras.fields, extras.values);
  if (rows.length === 0) return true;
  const { error } = await supabase.from("deal_field_values").upsert(rows as any, { onConflict: "deal_id,field_id" });
  if (error) console.error("[CreateDealExtras] Error saving fields:", error);
  return !error;
}

interface Member { id: string; name: string; avatar_url: string | null }

const NONE = "__none__";
const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

interface Props {
  value: CreateDealExtrasValue;
  onChange: (next: CreateDealExtrasValue) => void;
  /** Answers already on the lead (by field id); used only to pre-fill fields the lead shares with the deal. */
  leadFieldValues?: Record<string, unknown>;
}

export function CreateDealExtras({ value, onChange, leadFieldValues }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [members, setMembers] = useState<Member[]>([]);
  const [originSearch, setOriginSearch] = useState("");
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      const [{ data: access }, { data: defs }] = await Promise.all([
        supabase
          .from("user_sector_access")
          .select("user:users!user_sector_access_user_id_fkey(id, name, avatar_url, is_active)")
          .eq("sector_id", "vendas")
          .eq("account_id", accountId)
          .eq("is_active", true),
        supabase
          .from("custom_fields")
          .select("id, name, field_type, display_order, options")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .eq("show_in_deals", true),
      ]);
      if (cancelled) return;
      const seen = new Set<string>();
      const list = ((access as any[]) || [])
        .map((a) => a.user)
        .filter((u) => u?.name && u.is_active !== false && !isHiddenTechnicalPerson(u) && !seen.has(u.id) && seen.add(u.id))
        .map((u) => ({ id: u.id, name: u.name, avatar_url: u.avatar_url }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setMembers(list);

      const fields = pickCreateDealFields((defs as any[]) || []);
      const values = { ...latest.current.values };
      for (const f of fields) {
        const fromLead = leadFieldValues?.[f.id];
        if (values[f.id] == null && fromLead != null && fromLead !== "") values[f.id] = fromLead;
      }
      onChange({ ...latest.current, fields, values });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const sellerOptions = useMemo(() => {
    if (!currentUser?.id || members.some((m) => m.id === currentUser.id)) return members;
    return [{ id: currentUser.id, name: (currentUser as any).name || "Eu", avatar_url: (currentUser as any).avatar_url ?? null }, ...members];
  }, [members, currentUser]);

  const setField = (id: string, v: unknown) => {
    const values = { ...value.values, [id]: v };
    // Same qualification rule the deal card applies when the revenue range is chosen.
    const revenue = value.fields.find((f) => f.key === "faturamento");
    const mql = value.fields.find((f) => f.key === "mql");
    if (revenue?.id === id && mql) {
      const suggested = mqlFromRevenue(v, (revenue.options || []) as any);
      if (suggested && (mql.options || []).some((o) => o.value === suggested)) values[mql.id] = suggested;
    }
    onChange({ ...value, values });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Informações da venda</p>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Vendedor</Label>
          <Select
            value={value.sellerId || currentUser?.id || ""}
            onValueChange={(v) => onChange({ ...value, sellerId: v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {sellerOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{m.name}{m.id === currentUser?.id ? " (você)" : ""}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value.fields.map((f) => {
          const options = f.options || [];
          if (f.field_type === "multi_select") {
            const selected = Array.isArray(value.values[f.id]) ? (value.values[f.id] as string[]) : [];
            const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
            const q = originSearch.trim().toLowerCase();
            const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.name}</Label>
                <Popover modal>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <span className={cn("truncate text-left", labels.length === 0 && "text-muted-foreground")}>
                        {labels.length === 0 ? "Selecione" : labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={originSearch}
                        onChange={(e) => setOriginSearch(e.target.value)}
                        placeholder="Buscar..."
                        className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                      {visible.map((o) => {
                        const on = selected.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setField(f.id, on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                            className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted", on && "bg-muted")}
                          >
                            <Checkbox checked={on} className="pointer-events-none" />
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                      {visible.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma opção encontrada</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          }
          return (
            <div key={f.id} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{f.name}</Label>
              <Select
                value={(value.values[f.id] as string) || NONE}
                onValueChange={(v) => setField(f.id, v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}><span className="text-muted-foreground">Não informar agora</span></SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
