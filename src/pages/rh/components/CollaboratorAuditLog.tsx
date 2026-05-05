import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, Loader2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditEntry {
  id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  changed_fields: Record<string, boolean> | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  cpf: "CPF",
  rg: "RG",
  birth_date: "Nascimento",
  gender: "Gênero",
  marital_status: "Estado civil",
  address: "Endereço",
  city: "Cidade",
  state: "UF",
  zip_code: "CEP",
  neighborhood: "Bairro",
  address_complement: "Complemento",
  department: "Departamento",
  position: "Cargo",
  hire_date: "Admissão",
  termination_date: "Desligamento",
  employment_type: "Tipo de contrato",
  status: "Status",
  work_model: "Modelo de trabalho",
  unit: "Unidade",
  registration_company: "Empresa registro",
  cbo: "CBO",
  payroll_company: "Empresa folha",
  salary: "Salário",
  net_salary: "Salário líquido",
  base_salary: "Salário base",
  commissions: "Comissões",
  dsr_commissions: "DSR comissões",
  total_salary: "Total salário",
  inss_employer: "INSS Patronal",
  inss_third_parties: "INSS Terceiros",
  inss_gilrat: "INSS GILRAT",
  fgts: "FGTS",
  vacation_provision: "Provisão férias",
  vacation_third: "1/3 férias",
  thirteenth_provision: "Provisão 13º",
  total_charges: "Total encargos",
  health_plan: "Plano de saúde",
  life_insurance: "Seguro de vida",
  meal_voucher: "Vale refeição",
  transport_voucher: "Vale transporte",
  home_office_allowance: "Ajuda home office",
  total_benefits: "Total benefícios",
  other_costs: "Outros custos",
  total_cost: "Custo total",
  cost_pct: "% custo",
  monthly_total_cost: "Custo mensal",
  annual_total_cost: "Custo anual",
  notes: "Observações",
  source_note: "Origem",
  emergency_contact_name: "Contato emergência",
  emergency_contact_phone: "Telefone emergência",
  avatar_url: "Foto",
  hr_department_id: "Depto. (ID)",
};

function fieldLabel(k: string) {
  return FIELD_LABELS[k] ?? k;
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function actionBadge(a: string) {
  if (a === "create") return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Criação</Badge>;
  if (a === "delete") return <Badge variant="destructive">Exclusão</Badge>;
  return <Badge variant="secondary">Edição</Badge>;
}

export default function CollaboratorAuditLog({ collaboratorId }: { collaboratorId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("hr_collaborator_audit_log" as any)
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancel) return;
      if (!error) setEntries((data || []) as any);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [collaboratorId]);

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fields = Object.keys(e.changed_fields || {}).map(fieldLabel).join(" ");
    return (
      (e.user_name || "").toLowerCase().includes(q) ||
      (e.user_email || "").toLowerCase().includes(q) ||
      fields.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de alterações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário ou campo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma alteração registrada ainda.
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-3">
              {filtered.map((e) => {
                const fields = Object.keys(e.changed_fields || {});
                return (
                  <div key={e.id} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        {actionBadge(e.action)}
                        <span className="text-sm font-medium">
                          {e.user_name || e.user_email || "Sistema"}
                        </span>
                        {e.user_email && e.user_name && (
                          <span className="text-xs text-muted-foreground">{e.user_email}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    {e.action === "update" && fields.length > 0 && (
                      <div className="rounded-md border bg-muted/30 divide-y">
                        {fields.map((k) => (
                          <div key={k} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr] gap-2 p-2 text-xs">
                            <div className="font-medium">{fieldLabel(k)}</div>
                            <div className="text-muted-foreground">
                              <span className="text-[10px] uppercase mr-1">de</span>
                              <span className="line-through">{formatValue(e.old_values?.[k])}</span>
                            </div>
                            <div className="text-foreground">
                              <span className="text-[10px] uppercase mr-1 text-emerald-600">para</span>
                              {formatValue(e.new_values?.[k])}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {e.action === "create" && (
                      <div className="text-xs text-muted-foreground">Cadastro inicial criado.</div>
                    )}
                    {e.action === "delete" && (
                      <div className="text-xs text-muted-foreground">Registro removido.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
