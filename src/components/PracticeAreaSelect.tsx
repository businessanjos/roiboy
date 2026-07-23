import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePracticeAreas } from "@/hooks/usePracticeAreas";

interface PracticeAreaSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Match by 'label' (default) or 'slug' */
  valueKey?: "label" | "slug";
  className?: string;
}

/**
 * Dropdown reutilizável de Áreas de Atuação (carregado de public.practice_areas).
 */
export function PracticeAreaSelect({
  value,
  onChange,
  placeholder = "Selecione a área de atuação",
  disabled,
  valueKey = "label",
  className,
}: PracticeAreaSelectProps) {
  const { data: areas = [], isLoading } = usePracticeAreas();

  return (
    <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {areas.map((a) => (
          <SelectItem key={a.id} value={valueKey === "slug" ? a.slug : a.label}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
