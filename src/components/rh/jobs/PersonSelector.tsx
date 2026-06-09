import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountUsersForJobs } from "@/hooks/useHRJobStages";
import { useRecruitmentPartners } from "@/hooks/useRecruitmentPartners";

/**
 * Seletor unificado: usuário interno OU parceiro de R&S (PJ).
 * Emite uma das duas chaves preenchida via onChange.
 */
export function PersonSelector({
  userId,
  providerId,
  onChange,
  placeholder = "Selecione",
  allowNone = true,
  noneLabel = "Nenhum",
}: {
  userId: string | null | undefined;
  providerId: string | null | undefined;
  onChange: (next: { userId: string | null; providerId: string | null }) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { data: users } = useAccountUsersForJobs();
  const { data: partners } = useRecruitmentPartners();

  const value = useMemo(() => {
    if (providerId) return `provider:${providerId}`;
    if (userId) return `user:${userId}`;
    return "_none";
  }, [userId, providerId]);

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === "_none") return onChange({ userId: null, providerId: null });
        if (v.startsWith("provider:")) return onChange({ userId: null, providerId: v.slice(9) });
        if (v.startsWith("user:")) return onChange({ userId: v.slice(5), providerId: null });
      }}
    >
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="_none">{noneLabel}</SelectItem>}
        {(users && users.length > 0) && (
          <SelectGroup>
            <SelectLabel>Time interno</SelectLabel>
            {users.map((u) => (
              <SelectItem key={`u-${u.id}`} value={`user:${u.id}`}>{u.name || u.email}</SelectItem>
            ))}
          </SelectGroup>
        )}
        {(partners && partners.length > 0) && (
          <SelectGroup>
            <SelectLabel>Parceiros de R&S</SelectLabel>
            {partners.map((p) => (
              <SelectItem key={`p-${p.id}`} value={`provider:${p.id}`}>
                {p.company_name ? `${p.company_name} — ${p.full_name}` : p.full_name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
