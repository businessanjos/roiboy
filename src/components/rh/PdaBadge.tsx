import { Badge } from "@/components/ui/badge";
import { optionColor, PDA_CHIP_TEXT, PDA_COLORS, type PdaOption } from "@/lib/rh/pda";

interface Props {
  value?: string | null;
  options?: PdaOption[];
  color?: string;
  label?: string;
  className?: string;
}

/** Badge colorida padrão do PDA (mesmo padrão visual das badges de produto). */
export function PdaBadge({ value, options, color, label, className }: Props) {
  if (!value && !label) return <span className="text-muted-foreground">—</span>;
  const c = color || (options ? optionColor(options, value) : PDA_COLORS.cinza);
  const optionLabel = options?.find((o) => o.value === value)?.label;
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium whitespace-nowrap ${className || ""}`}
      style={{ backgroundColor: c, borderColor: c, color: PDA_CHIP_TEXT }}
    >
      {label ?? value}
    </Badge>
  );
}

export function YesNoBadge({ value }: { value?: boolean | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const c = value ? PDA_COLORS.verde : PDA_COLORS.vermelho;
  return <PdaBadge value={value ? "SIM" : "NÃO"} color={c} />;
}
