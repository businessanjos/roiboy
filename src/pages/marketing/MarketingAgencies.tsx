import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, BarChart3, Pencil, Inbox, GitCompare, Wand2 } from "lucide-react";
import { useTrafficAgencies } from "@/hooks/useTrafficAgencies";
import { AgencyFormDialog } from "@/components/marketing/agencies/AgencyFormDialog";
import { AgencyMembersDialog } from "@/components/marketing/agencies/AgencyMembersDialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MarketingAgencies() {
  const { data: agencies = [], isLoading } = useTrafficAgencies();
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [reapplying, setReapplying] = useState(false);

  async function handleReapplyRules() {
    if (!currentUser?.account_id) return;
    setReapplying(true);
    try {
      const { data, error } = await (supabase as any).rpc("apply_agency_rules", {
        p_account_id: currentUser.account_id,
      });
      if (error) throw error;
      toast.success(`${data ?? 0} campanha(s) reatribuída(s)`);
      qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
      qc.invalidateQueries({ queryKey: ["marketing-ad-sets"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao reaplicar regras");
    } finally {
      setReapplying(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agências de Tráfego</h1>
          <p className="text-muted-foreground mt-1">
            Cadastre as agências parceiras, compare a performance e dê acesso restrito ao ROY.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReapplyRules} disabled={reapplying}>
            <Wand2 className="h-4 w-4 mr-2" />
            {reapplying ? "Reaplicando..." : "Reaplicar regras"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/marketing/agencias/comparativo")}>
            <GitCompare className="h-4 w-4 mr-2" />
            Comparar agências
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova agência
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && agencies.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Nenhuma agência cadastrada ainda</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie sua primeira agência e tagueie suas campanhas Meta para começar.
            </p>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar agência
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agencies.map((a) => (
          <Card key={a.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-2" style={{ background: a.color }} />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: a.color }}
                  />
                  {a.name}
                </CardTitle>
                {!a.is_active && <Badge variant="outline">Inativa</Badge>}
              </div>
              {a.contact_name && (
                <p className="text-xs text-muted-foreground">{a.contact_name}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded-md bg-muted/40">
                  <div className="text-xs text-muted-foreground">Campanhas</div>
                  <div className="font-semibold">{a.campaignsCount ?? 0}</div>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                  <div className="text-xs text-muted-foreground">Invest. mês</div>
                  <div className="font-semibold">{fmtBRL(a.spendThisMonth ?? 0)}</div>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                  <div className="text-xs text-muted-foreground">Leads mês</div>
                  <div className="font-semibold">{a.leadsThisMonth ?? 0}</div>
                </div>
                <div className="p-2 rounded-md bg-muted/40">
                  <div className="text-xs text-muted-foreground">Solicitações abertas</div>
                  <div className="font-semibold">{a.openRequests ?? 0}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="default" className="flex-1" onClick={() => navigate(`/marketing/agencias/${a.id}`)}>
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Dashboard
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMembersFor(a.id)}>
                  <Users className="h-4 w-4 mr-1" />
                  {a.membersCount ?? 0}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(a); setFormOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AgencyFormDialog open={formOpen} onOpenChange={setFormOpen} agency={editing} />
      {membersFor && (
        <AgencyMembersDialog
          open={!!membersFor}
          onOpenChange={(v) => !v && setMembersFor(null)}
          agencyId={membersFor}
        />
      )}
    </div>
  );
}
