import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Wallet } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SALES_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090",
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
  "d20201f6-a9bd-4934-ae50-07ce7a47574b",
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8",
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6",
  "cefc44c7-d2e2-4937-94ac-069c1c94731b",
];

export function OTESection({ year }: { year: number }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { userOTEs, upsertOTE } = useQuotasIncentives(year, 1);

  const [drafts, setDrafts] = useState<Record<string, { base: number; variable: number }>>({});

  const usersQuery = useQuery({
    queryKey: ["sales-team-users", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!)
        .in("id", SALES_USER_IDS)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const users = usersQuery.data ?? [];

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              OTE — On-Target Earnings ({year})
            </CardTitle>
            <CardDescription>Ganho-alvo anual por vendedor: salário base + variável ao atingir 100% da meta</CardDescription>
          </div>
          <Button onClick={handleSaveAll} disabled={Object.keys(drafts).length === 0 || upsertOTE.isPending} size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            Salvar OTEs
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-center w-[160px]">Base Anual (R$)</TableHead>
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
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      className="w-36 text-center mx-auto"
                      value={ote.base || ""}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev,
                        [user.id]: { ...getOTE(user.id), base: parseFloat(e.target.value) || 0 },
                      }))}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      className="w-36 text-center mx-auto"
                      value={ote.variable || ""}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev,
                        [user.id]: { ...getOTE(user.id), variable: parseFloat(e.target.value) || 0 },
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
  );
}
