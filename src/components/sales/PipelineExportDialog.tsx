import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DealStage } from "@/hooks/useDeals";
import { SectorUser } from "@/hooks/useSectorUsers";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

interface PipelineExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: DealStage[];
  salesUsers: SectorUser[];
}

interface CustomFieldDef {
  id: string;
  name: string;
  field_type: string;
  options: { value: string; label: string; color: string }[];
}

const FIXED_FIELDS = [
  { key: "title", label: "Título do negócio" },
  { key: "lead_name", label: "Lead (nome)" },
  { key: "lead_phone", label: "Telefone do lead" },
  { key: "lead_email", label: "Email do lead" },
  { key: "stage", label: "Etapa" },
  { key: "responsible", label: "Responsável" },
  { key: "value", label: "Valor" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Data de criação" },
  { key: "won_lost_at", label: "Data de ganho/perda" },
  { key: "lost_reason", label: "Motivo de perda" },
  { key: "probability", label: "Probabilidade" },
  { key: "tags", label: "Tags" },
] as const;

export function PipelineExportDialog({
  open,
  onOpenChange,
  stages,
  salesUsers,
}: PipelineExportDialogProps) {
  const { currentUser } = useCurrentUser();
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [exporting, setExporting] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterMql, setFilterMql] = useState("all");
  const [filterFaturamento, setFilterFaturamento] = useState("all");
  const [filterCanal, setFilterCanal] = useState("all");

  // Products list
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  // Custom fields definitions (show_in_deals)
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  // Selected fields
  const [selectedFixed, setSelectedFixed] = useState<Set<string>>(
    new Set(FIXED_FIELDS.map((f) => f.key))
  );
  const [selectedCustom, setSelectedCustom] = useState<Set<string>>(new Set());

  // Fetch custom fields and products on open
  useEffect(() => {
    if (!open || !currentUser?.account_id) return;

    const fetchData = async () => {
      const [fieldsRes, productsRes] = await Promise.all([
        supabase
          .from("custom_fields")
          .select("id, name, field_type, options")
          .eq("account_id", currentUser.account_id)
          .eq("is_active", true)
          .eq("show_in_deals", true)
          .order("display_order"),
        supabase
          .from("products")
          .select("id, name")
          .eq("account_id", currentUser.account_id)
          .eq("is_active", true)
          .order("name"),
      ]);

      const fields: CustomFieldDef[] = (fieldsRes.data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type,
        options: Array.isArray(f.options) ? f.options : [],
      }));
      setCustomFields(fields);
      setSelectedCustom(new Set(fields.map((f) => f.id)));
      setProducts(productsRes.data || []);
    };
    fetchData();
  }, [open, currentUser?.account_id]);

  // Helper: get custom field options by name (case-insensitive partial match)
  const getFieldByName = useCallback(
    (partialName: string) =>
      customFields.find((f) =>
        f.name.toLowerCase().includes(partialName.toLowerCase())
      ),
    [customFields]
  );

  const mqlField = getFieldByName("mql");
  const faturamentoField = getFieldByName("faturamento");
  const canalField = getFieldByName("canal");

  const toggleFixed = (key: string) => {
    setSelectedFixed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleCustom = (id: string) => {
    setSelectedCustom((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFixed(new Set(FIXED_FIELDS.map((f) => f.key)));
    setSelectedCustom(new Set(customFields.map((f) => f.id)));
  };

  const deselectAll = () => {
    setSelectedFixed(new Set());
    setSelectedCustom(new Set());
  };

  // Resolve select/multi_select label
  const resolveLabel = (field: CustomFieldDef, rawValue: any): string => {
    if (rawValue == null) return "";
    if (field.field_type === "select") {
      const opt = field.options.find((o) => o.value === rawValue);
      return opt ? opt.label : String(rawValue);
    }
    if (field.field_type === "multi_select") {
      const arr = Array.isArray(rawValue) ? rawValue : [];
      return arr
        .map((v: string) => {
          const opt = field.options.find((o) => o.value === v);
          return opt ? opt.label : v;
        })
        .join(", ");
    }
    if (field.field_type === "boolean") return rawValue ? "Sim" : "Não";
    if (field.field_type === "currency" && rawValue != null) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(rawValue));
    }
    return String(rawValue ?? "");
  };

  const handleExport = async () => {
    if (!currentUser?.account_id) return;
    if (selectedFixed.size === 0 && selectedCustom.size === 0) {
      toast.error("Selecione ao menos um campo para exportar.");
      return;
    }

    setExporting(true);
    try {
      // 1. Fetch all deals with pagination
      let allDeals: any[] = [];
      let page = 0;
      const PAGE_SIZE = 500;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("deals")
          .select(
            `id, title, value, status, probability, tags, created_at, won_at, lost_at, lost_reason, stage_id, responsible_user_id, lead_id, product_id,
            leads(full_name, phone, email)`
          )
          .eq("account_id", currentUser.account_id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        allDeals = allDeals.concat(batch || []);
        hasMore = (batch?.length || 0) === PAGE_SIZE;
        page++;
      }

      // 2. Fetch all deal_field_values in chunks
      const dealIds = allDeals.map((d) => d.id);
      let allFieldValues: any[] = [];
      const CHUNK = 200;
      for (let i = 0; i < dealIds.length; i += CHUNK) {
        const chunk = dealIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("deal_field_values")
          .select("deal_id, field_id, value_text, value_number, value_boolean, value_date, value_json")
          .in("deal_id", chunk);
        allFieldValues = allFieldValues.concat(data || []);
      }

      // Index field values by deal_id
      const fieldValuesByDeal: Record<string, any[]> = {};
      allFieldValues.forEach((fv) => {
        if (!fieldValuesByDeal[fv.deal_id]) fieldValuesByDeal[fv.deal_id] = [];
        fieldValuesByDeal[fv.deal_id].push(fv);
      });

      // Build stages/users maps
      const stagesMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));
      const usersMap = Object.fromEntries(salesUsers.map((u) => [u.id, u.name]));
      const productsMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

      // 3. Apply filters
      let filtered = allDeals;

      if (filterStatus !== "all") {
        filtered = filtered.filter((d) => d.status === filterStatus);
      }
      if (filterResponsible !== "all") {
        filtered = filtered.filter(
          (d) => d.responsible_user_id === filterResponsible
        );
      }
      if (filterStage !== "all") {
        filtered = filtered.filter((d) => d.stage_id === filterStage);
      }
      if (filterProduct !== "all") {
        filtered = filtered.filter((d) => d.product_id === filterProduct);
      }

      // Custom field filters (MQL, Faturamento, Canal)
      const applyCustomFieldFilter = (
        deals: any[],
        fieldDef: CustomFieldDef | undefined,
        filterValue: string
      ) => {
        if (!fieldDef || filterValue === "all") return deals;
        return deals.filter((d) => {
          const fvs = fieldValuesByDeal[d.id] || [];
          const fv = fvs.find((v: any) => v.field_id === fieldDef.id);
          if (!fv) return false;
          if (fieldDef.field_type === "select") return fv.value_text === filterValue;
          if (fieldDef.field_type === "multi_select") {
            const arr = Array.isArray(fv.value_json) ? fv.value_json : [];
            return arr.includes(filterValue);
          }
          return false;
        });
      };

      filtered = applyCustomFieldFilter(filtered, mqlField, filterMql);
      filtered = applyCustomFieldFilter(filtered, faturamentoField, filterFaturamento);
      filtered = applyCustomFieldFilter(filtered, canalField, filterCanal);

      if (filtered.length === 0) {
        toast.warning("Nenhum negócio encontrado com os filtros selecionados.");
        setExporting(false);
        return;
      }

      // 4. Build rows
      const customFieldsArray = customFields.filter((f) =>
        selectedCustom.has(f.id)
      );

      const headers: string[] = [];
      FIXED_FIELDS.forEach((f) => {
        if (selectedFixed.has(f.key)) headers.push(f.label);
      });
      customFieldsArray.forEach((f) => headers.push(f.name));

      const rows = filtered.map((deal) => {
        const row: string[] = [];
        const lead = deal.leads;
        const fvs = fieldValuesByDeal[deal.id] || [];

        if (selectedFixed.has("title")) row.push(deal.title || "");
        if (selectedFixed.has("lead_name"))
          row.push(lead?.full_name || "");
        if (selectedFixed.has("lead_phone"))
          row.push(lead?.phone || "");
        if (selectedFixed.has("lead_email"))
          row.push(lead?.email || "");
        if (selectedFixed.has("stage"))
          row.push(stagesMap[deal.stage_id] || "");
        if (selectedFixed.has("responsible"))
          row.push(usersMap[deal.responsible_user_id] || "");
        if (selectedFixed.has("value"))
          row.push(
            deal.value != null
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(deal.value)
              : ""
          );
        if (selectedFixed.has("status")) {
          const statusLabels: Record<string, string> = {
            open: "Em Aberto",
            won: "Ganha",
            lost: "Perdida",
          };
          row.push(statusLabels[deal.status] || deal.status);
        }
        if (selectedFixed.has("created_at"))
          row.push(
            deal.created_at
              ? new Date(deal.created_at).toLocaleDateString("pt-BR")
              : ""
          );
        if (selectedFixed.has("won_lost_at"))
          row.push(
            (deal.won_at || deal.lost_at)
              ? new Date(deal.won_at || deal.lost_at).toLocaleDateString(
                  "pt-BR"
                )
              : ""
          );
        if (selectedFixed.has("lost_reason"))
          row.push(deal.lost_reason || "");
        if (selectedFixed.has("probability"))
          row.push(deal.probability != null ? `${deal.probability}%` : "");
        if (selectedFixed.has("tags"))
          row.push(
            Array.isArray(deal.tags) ? deal.tags.join(", ") : ""
          );

        // Custom fields
        customFieldsArray.forEach((cf) => {
          const fv = fvs.find((v: any) => v.field_id === cf.id);
          if (!fv) {
            // Special case: product_id for "Item da Venda" type fields
            if (cf.name.toLowerCase().includes("item") && deal.product_id) {
              row.push(productsMap[deal.product_id] || deal.product_id);
            } else {
              row.push("");
            }
            return;
          }

          let rawValue: any;
          switch (cf.field_type) {
            case "boolean":
              rawValue = fv.value_boolean;
              break;
            case "number":
            case "currency":
              rawValue = fv.value_number;
              break;
            case "date":
              rawValue = fv.value_date
                ? new Date(fv.value_date).toLocaleDateString("pt-BR")
                : "";
              break;
            case "select":
            case "text":
            case "instagram":
              rawValue = fv.value_text;
              break;
            case "multi_select":
            case "user":
            case "location":
            case "multi_instagram":
              rawValue = fv.value_json;
              break;
            default:
              rawValue = fv.value_text || fv.value_number || "";
          }

          row.push(resolveLabel(cf, rawValue));
        });

        return row;
      });

      // 5. Generate file
      if (format === "xlsx") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Negócios");
        XLSX.writeFile(wb, "negocios_pipeline.xlsx");
      } else {
        const csvContent =
          "\uFEFF" +
          [headers, ...rows].map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "negocios_pipeline.csv";
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${filtered.length} negócios exportados com sucesso!`);
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar negócios.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Negócios
          </DialogTitle>
          <DialogDescription>
            Selecione o formato, filtros e campos para exportar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-5 pb-2">
            {/* Format */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Formato</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as "csv" | "xlsx")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                  <Label htmlFor="fmt-xlsx" className="cursor-pointer">
                    XLSX (Excel)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <Label htmlFor="fmt-csv" className="cursor-pointer">
                    CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Filters */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Filtros</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="open">Em Aberto</SelectItem>
                      <SelectItem value="won">Ganhas</SelectItem>
                      <SelectItem value="lost">Perdidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Responsavel */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {salesUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Etapa */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Etapa</Label>
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Produto */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select value={filterProduct} onValueChange={setFilterProduct}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* MQL */}
                {mqlField && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{mqlField.name}</Label>
                    <Select value={filterMql} onValueChange={setFilterMql}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {mqlField.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Faturamento */}
                {faturamentoField && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{faturamentoField.name}</Label>
                    <Select value={filterFaturamento} onValueChange={setFilterFaturamento}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {faturamentoField.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Canal */}
                {canalField && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{canalField.name}</Label>
                    <Select value={filterCanal} onValueChange={setFilterCanal}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {canalField.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Field selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Campos para exportar</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={selectAll}
                  >
                    Marcar todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={deselectAll}
                  >
                    Desmarcar todos
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FIXED_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedFixed.has(f.key)}
                      onCheckedChange={() => toggleFixed(f.key)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>

              {customFields.length > 0 && (
                <>
                  <Label className="text-xs text-muted-foreground mt-4 mb-2 block">
                    Campos personalizados
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {customFields.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedCustom.has(f.id)}
                          onCheckedChange={() => toggleCustom(f.id)}
                        />
                        {f.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
