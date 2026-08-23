import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const PAYMENT_STATUS_OPTIONS: Record<string, { label: string; group: string; className: string }> = {
  cheque_enviado: { label: "Cheque enviado", group: "Cheque", className: "bg-info/15 text-info" },
  cheque_pendente: { label: "Cheque pendente", group: "Cheque", className: "bg-warning/15 text-warning" },
  cheque_recebido: { label: "Cheque recebido", group: "Cheque", className: "bg-success/15 text-success" },
  cheque_devolvido: { label: "Cheque devolvido", group: "Cheque", className: "bg-destructive/15 text-destructive" },
  boleto_emitido: { label: "Boleto emitido", group: "Boleto", className: "bg-info/15 text-info" },
  boleto_registrado: { label: "Boleto registrado", group: "Boleto", className: "bg-info/15 text-info" },
  boleto_pago: { label: "Boleto pago", group: "Boleto", className: "bg-success/15 text-success" },
  cartao_autorizado: { label: "Cartão autorizado", group: "Cartão", className: "bg-info/15 text-info" },
  cartao_capturado: { label: "Cartão capturado", group: "Cartão", className: "bg-success/15 text-success" },
  cartao_estornado: { label: "Cartão estornado", group: "Cartão", className: "bg-pink-500/15 text-pink-600" },
  pix_aguardando: { label: "PIX aguardando", group: "PIX", className: "bg-warning/15 text-warning" },
  pix_confirmado: { label: "PIX confirmado", group: "PIX", className: "bg-success/15 text-success" },
  transferencia_pendente: { label: "Transferência pendente", group: "Transferência", className: "bg-warning/15 text-warning" },
  transferencia_confirmada: { label: "Transferência confirmada", group: "Transferência", className: "bg-success/15 text-success" },
};

const GROUPS = ["Cheque", "Boleto", "Cartão", "PIX", "Transferência"];

export function PaymentStatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
  const meta = PAYMENT_STATUS_OPTIONS[value];
  if (!meta) return <Badge variant="outline">{value}</Badge>;
  return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
}

export function PaymentStatusSelect({
  installmentId,
  value,
  onChange,
}: {
  installmentId: string;
  value: string | null;
  onChange?: (v: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    if (next === value) return;
    setSaving(true);
    const { error } = await supabase
      .from("installments")
      .update({ payment_status: next })
      .eq("id", installmentId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
      return;
    }
    toast.success("Status atualizado");
    onChange?.(next);
  };

  return (
    <Select value={value ?? ""} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="w-56 h-8">
        <SelectValue placeholder="Definir status detalhado…" />
      </SelectTrigger>
      <SelectContent>
        {GROUPS.map((g) => (
          <SelectGroup key={g}>
            <SelectLabel>{g}</SelectLabel>
            {Object.entries(PAYMENT_STATUS_OPTIONS)
              .filter(([, m]) => m.group === g)
              .map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  {m.label}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
