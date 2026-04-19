import { useState } from "react";

const formatBRL = (value: number): string => {
  if (!value) return "";
  return value.toLocaleString("pt-BR");
};

const parseBRL = (value: string): number => {
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  return parseFloat(cleaned) || 0;
};
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Wallet, Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface OTESectionProps {
  year: number;
  positionId: string;
  positionTitle?: string;
}

export function OTESection({ year, positionId, positionTitle }: OTESectionProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { userOTEs, upsertOTE } = useQuotasIncentives(year, 1);

  const [drafts, setDrafts] = useState<Record<string, { base: number; variable: number }>>({});

  // Buscar colaboradores HR vinculados a este cargo (match por título)
  const collaboratorsQuery = useQuery({
    queryKey: ["sales-collaborators-by-position", accountId, positionTitle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, salary, employment_type, full_name, position")
        .eq("account_id", accountId!)
        .ilike("position", `%${positionTitle}%`)
        .not("user_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && !!positionTitle,
  });

  const collaborators = collaboratorsQuery.data ?? [];
  const userIds = collaborators.map((c) => c.user_id).filter(Boolean) as string[];

  const usersQuery = useQuery({
    queryKey: ["sales-team-users-by-position", accountId, positionId, userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!)
        .in("id", userIds)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && userIds.length > 0,
  });

  const users = usersQuery.data ?? [];

  // Calcula a Base Anual automaticamente a partir do RH:
  // CLT: salário × 13,33 (12 meses + 13º + 1/3 férias) + ~70% encargos patronais (FGTS, INSS, provisões)
  // PJ/Sócio/Outros: salário × 12 (sem encargos sobre folha)
  const calculateAnnualBase = (userId: string): { value: number; breakdown: string } | null => {
    const collab = collaborators.find((c) => c.user_id === userId);
    if (!collab || !collab.salary) return null;
    const monthly = Number(collab.salary);
    const type = (collab.employment_type || "").toLowerCase();
    if (type === "clt") {
      const grossAnnual = monthly * 13.33;
      const employerCharges = grossAnnual * 0.7;
      const total = grossAnnual + employerCharges;
      return {
        value: Math.round(total),
        breakdown: `R$ ${monthly.toLocaleString("pt-BR")}/mês CLT × 13,33 + 70% encargos patronais (FGTS, INSS, provisões)`,
      };
    }
    return {
      value: Math.round(monthly * 12),
      breakdown: `R$ ${monthly.toLocaleString("pt-BR")}/mês ${(collab.employment_type || "").toUpperCase()} × 12`,
    };
  };

  const handleAutoFill = () => {
    const newDrafts: Record<string, { base: number; variable: number }> = { ...drafts };
    let count = 0;
    for (const user of users) {
      const calc = calculateAnnualBase(user.id);
      if (calc) {
        const existing = userOTEs.find((o) => o.user_id === user.id);
        const variable = drafts[user.id]?.variable ?? (existing ? Number(existing.variable_target_annual) : 0);
        newDrafts[user.id] = { base: calc.value, variable };
        count++;
      }
    }
    setDrafts(newDrafts);
    if (count === 0) {
      toast.warning("Nenhum vendedor com salário cadastrado no RH");
    } else {
      toast.success(`Base anual calculada para ${count} vendedor(es) a partir do RH`);
    }
  };

  const getOTE = (userId: string) => {
    if (drafts[userId]) return drafts[userId];
    const existing = userOTEs.find((o) => o.user_id === userId);
    return existing ? { base: Number(existing.base_salary_annual), variable: Number(existing.variable_target_annual) } : { base: 0, variable: 0 };
  };

  const handleSaveAll = async () => {
    for (const [userId, d] of Object.entries(drafts)) {
      await upsertOTE.mutateAsync({
        user_id: userId,
        year,
        base_salary_annual: d.base,
        variable_target_annual: d.variable,
      });
    }
    setDrafts({});
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                OTE — On-Target Earnings ({year})
              </CardTitle>
              <CardDescription>
                Base puxada do RH (CLT: salário × 13,33 + 70% encargos · PJ/Sócio: × 12). Variável = comissões + bônus a 100% da meta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAutoFill} variant="outline" size="sm" className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                Calcular do RH
              </Button>
              <Button onClick={handleSaveAll} disabled={Object.keys(drafts).length === 0 || upsertOTE.isPending} size="sm" className="gap-1.5">
                <Save className="h-4 w-4" />
                Salvar OTEs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center w-[100px]">Regime</TableHead>
                <TableHead className="text-center w-[180px]">Base Anual (R$)</TableHead>
                <TableHead className="text-center w-[160px]">Variável Anual (R$)</TableHead>
                <TableHead className="text-right w-[140px]">OTE Total (R$)</TableHead>
                <TableHead className="text-right w-[120px]">Pay Mix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const ote = getOTE(user.id);
                const total = ote.base + ote.variable;
                const basePct = total > 0 ? Math.round((ote.base / total) * 100) : 0;
                const collab = collaborators.find((c) => c.user_id === user.id);
                const calc = calculateAnnualBase(user.id);
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-center">
                      {collab?.employment_type ? (
                        <Badge variant="outline" className="text-xs uppercase">{collab.employment_type}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-36 text-center"
                          value={formatBRL(ote.base)}
                          placeholder={calc ? formatBRL(calc.value) : "—"}
                          onChange={(e) => setDrafts((prev) => ({
                            ...prev,
                            [user.id]: { ...getOTE(user.id), base: parseBRL(e.target.value) },
                          }))}
                        />
                        {calc && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs max-w-xs">{calc.breakdown}</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="w-36 text-center mx-auto"
                        value={formatBRL(ote.variable)}
                        onChange={(e) => setDrafts((prev) => ({
                          ...prev,
                          [user.id]: { ...getOTE(user.id), variable: parseBRL(e.target.value) },
                        }))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {total > 0 ? `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {total > 0 ? `${basePct}/${100 - basePct}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
