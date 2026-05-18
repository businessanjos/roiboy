import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Percent, Briefcase, HeartHandshake } from "lucide-react";
import { CommissionTab } from "@/components/sales/commission/CommissionTab";
import { CommissionConsultantBreakdown } from "@/components/financial/CommissionConsultantBreakdown";
import { CsIncentivePlanSection } from "@/components/operations/CsIncentivePlanSection";
import { ConsultantPayoutTable } from "@/components/operations/ConsultantPayoutTable";
import { useConsultantGoals } from "@/hooks/useConsultantGoals";
import { fetchActiveConsultants } from "@/lib/consultants";
import { FinancialPageHeader } from "@/components/financial/_shared";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function FinancialCommissionsPage() {
  const { currentUser } = useCurrentUser();
  const [year] = useState(new Date().getFullYear());
  const { goals, isLoading: goalsLoading } = useConsultantGoals(year);

  const { data: consultants = [] } = useQuery({
    queryKey: ["consultants-list", currentUser?.account_id],
    queryFn: fetchActiveConsultants,
    enabled: !!currentUser?.account_id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["bonus-products", currentUser?.account_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, color, consultant_seniority")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!currentUser?.account_id,
  });

  const goalsByConsultant = useMemo(() => {
    const map = new Map<string, typeof goals>();
    for (const g of goals) {
      const arr = map.get(g.user_id) || [];
      arr.push(g);
      map.set(g.user_id, arr);
    }
    return map;
  }, [goals]);

  const [activeConsultant, setActiveConsultant] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={Percent}
        title="Gestão de Comissões"
        description="Regras vindas dos planos de incentivo de Vendas e Operações. Os pagamentos são calculados a partir dos negócios ganhos no pipeline."
      />

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sales" className="gap-1.5">
                <Briefcase className="h-4 w-4" />
                Comercial
              </TabsTrigger>
              <TabsTrigger value="operations" className="gap-1.5">
                <HeartHandshake className="h-4 w-4" />
                Operações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Comissões calculadas a partir do plano (Closer e SDR) sobre os negócios marcados como
                <span className="font-medium text-foreground"> Ganho </span>
                no pipeline de vendas.
              </div>
              <CommissionTab />
              <CommissionConsultantBreakdown />
            </TabsContent>

            <TabsContent value="operations" className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Bônus e premiações das consultoras de operação, conforme o plano de incentivo do CS
                (renovação, churn e NPS) e a apuração mensal por consultora.
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plano de Incentivo (CS)</CardTitle>
                  <CardDescription>
                    Regras de bônus mensais, trimestrais, anuais e penalidades aplicáveis ao time de operações.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CsIncentivePlanSection />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Apuração de Bônus por Consultora — {year}</CardTitle>
                  <CardDescription>
                    Valores calculados a partir das metas configuradas em Operações › Premiação & Bônus.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {goalsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : consultants.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma consultora ativa encontrada.
                    </div>
                  ) : (
                    <Tabs
                      value={activeConsultant ?? consultants[0]?.id ?? ""}
                      onValueChange={setActiveConsultant}
                      className="w-full"
                    >
                      <TabsList className="flex-wrap h-auto">
                        {consultants.map((c: any) => (
                          <TabsTrigger key={c.id} value={c.id} className="gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback>
                            </Avatar>
                            {c.name.split(" ")[0]}
                            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                              {goalsByConsultant.get(c.id)?.length || 0}
                            </Badge>
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {consultants.map((c: any) => {
                        const consultantGoals = goalsByConsultant.get(c.id) || [];
                        return (
                          <TabsContent key={c.id} value={c.id} className="mt-4">
                            {consultantGoals.length === 0 ? (
                              <div className="text-center text-sm text-muted-foreground py-8">
                                Sem metas configuradas para {c.name.split(" ")[0]} em {year}.
                              </div>
                            ) : (
                              <ConsultantPayoutTable
                                goals={consultantGoals}
                                userId={c.id}
                                year={year}
                                products={products as any}
                              />
                            )}
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
