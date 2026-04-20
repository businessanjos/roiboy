import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface PaymentBreakdownItem {
  method: string;
  method_label: string;
  amount: number | null;
  installments: number | null;
  first_due_date: string | null;
}

interface PaymentBreakdownComposerProps {
  paymentMethodValue: string;
  paymentMethodLabel: string;
  value: PaymentBreakdownItem[];
  onChange: (value: PaymentBreakdownItem[]) => void;
}

// Maps a "Forma da Pagamento" select value into the individual methods that need detailing.
// Returns an empty array when the option doesn't require breakdown (e.g. plain Pix).
export function getMethodsForPaymentOption(value: string): Array<{ key: string; label: string }> {
  switch (value) {
    case "pix_cheques":
      return [
        { key: "pix", label: "Pix" },
        { key: "cheques", label: "Cheques" },
      ];
    case "pix_cartao_cheques":
      return [
        { key: "pix", label: "Pix" },
        { key: "cartao", label: "Cartão de crédito" },
        { key: "cheques", label: "Cheques" },
      ];
    case "pix_boleto_parcelado":
      return [
        { key: "pix", label: "Pix" },
        { key: "boleto", label: "Boleto parcelado" },
      ];
    case "cartao_credito":
      return [{ key: "cartao", label: "Cartão de crédito" }];
    case "cartao_cheques":
      return [
        { key: "cartao", label: "Cartão de crédito" },
        { key: "cheques", label: "Cheques" },
      ];
    case "cartao_boleto_parcelado":
      return [
        { key: "cartao", label: "Cartão de crédito" },
        { key: "boleto", label: "Boleto parcelado" },
      ];
    case "cheques":
      return [{ key: "cheques", label: "Cheques" }];
    case "cartao_recorrencia":
      return [{ key: "cartao_recorrencia", label: "Cartão recorrência" }];
    case "opt_1768604267839": // Pix + Cartão de crédito
      return [
        { key: "pix", label: "Pix" },
        { key: "cartao", label: "Cartão de crédito" },
      ];
    default:
      return [];
  }
}

export function PaymentBreakdownComposer({
  paymentMethodValue,
  paymentMethodLabel,
  value,
  onChange,
}: PaymentBreakdownComposerProps) {
  const methods = useMemo(() => getMethodsForPaymentOption(paymentMethodValue), [paymentMethodValue]);

  // Sync items: ensure there's an entry for each required method
  const items = useMemo<PaymentBreakdownItem[]>(() => {
    return methods.map((m) => {
      const existing = value.find((v) => v.method === m.key);
      return (
        existing ?? {
          method: m.key,
          method_label: m.label,
          amount: null,
          installments: null,
          first_due_date: null,
        }
      );
    });
  }, [methods, value]);

  const updateItem = (key: string, patch: Partial<PaymentBreakdownItem>) => {
    const next = items.map((item) => (item.method === key ? { ...item, ...patch } : item));
    onChange(next);
  };

  const total = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  if (methods.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Detalhamento — {paymentMethodLabel}
        </p>
        {total > 0 && (
          <span className="text-xs font-medium text-foreground">
            Total: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        )}
      </div>

      {items.map((item) => (
        <div key={item.method} className="rounded-md bg-background border border-border p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">{item.method_label}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={item.amount ?? ""}
                onChange={(e) =>
                  updateItem(item.method, {
                    amount: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
                placeholder="0,00"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº de parcelas</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={item.installments ?? ""}
                onChange={(e) =>
                  updateItem(item.method, {
                    installments: e.target.value === "" ? null : parseInt(e.target.value, 10),
                  })
                }
                placeholder="1"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data da 1ª parcela</Label>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal h-9",
                      !item.first_due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {item.first_due_date
                      ? format(new Date(item.first_due_date), "PPP", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={item.first_due_date ? new Date(item.first_due_date) : undefined}
                    onSelect={(date) =>
                      updateItem(item.method, {
                        first_due_date: date ? format(date, "yyyy-MM-dd") : null,
                      })
                    }
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {item.first_due_date && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => updateItem(item.method, { first_due_date: null })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function isBreakdownComplete(items: PaymentBreakdownItem[]): boolean {
  if (!items || items.length === 0) return false;
  return items.every(
    (i) =>
      i.amount !== null && i.amount > 0 && i.installments !== null && i.installments > 0 && !!i.first_due_date
  );
}
