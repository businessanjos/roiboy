import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HRCollaborator } from "@/hooks/useHRCollaborators";
import { DollarSign, Receipt, Gift, Wallet, Building2 } from "lucide-react";

interface Props {
  form: Partial<HRCollaborator>;
  setField: (key: string, value: any) => void;
}

function CurrencyInput({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
      <Input
        type="number"
        step="0.01"
        className="pl-9"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : parseFloat(v));
        }}
        placeholder={placeholder ?? "0,00"}
        inputMode="decimal"
      />
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className="relative">
      <Input
        type="number"
        step="0.1"
        className="pr-7"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : parseFloat(v));
        }}
        placeholder="0,0"
        inputMode="decimal"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </div>
  );
}

export default function CollaboratorPayroll({ form, setField }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Registro & Vínculo de Folha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Empresa de Registro</Label><Input value={form.registration_company || ""} onChange={e => setField("registration_company", e.target.value)} /></div>
          <div><Label>Empresa Folha</Label><Input value={form.payroll_company || ""} onChange={e => setField("payroll_company", e.target.value)} /></div>
          <div><Label>CBO-MTE</Label><Input value={form.cbo || ""} onChange={e => setField("cbo", e.target.value)} /></div>
          <div><Label>Modelo de Trabalho</Label><Input value={form.work_model || ""} onChange={e => setField("work_model", e.target.value)} placeholder="HOME OFFICE / PRESENCIAL" /></div>
          <div><Label>Unidade</Label><Input value={form.unit || ""} onChange={e => setField("unit", e.target.value)} /></div>
          <div><Label>Bairro</Label><Input value={form.neighborhood || ""} onChange={e => setField("neighborhood", e.target.value)} /></div>
          <div className="md:col-span-3"><Label>Complemento</Label><Input value={form.address_complement || ""} onChange={e => setField("address_complement", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Salário</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Salário líquido</Label><CurrencyInput value={form.net_salary} onChange={v => setField("net_salary", v)} /></div>
          <div><Label>Salário base</Label><CurrencyInput value={form.base_salary} onChange={v => { setField("base_salary", v); setField("salary", v); }} /></div>
          <div><Label>Salário total</Label><CurrencyInput value={form.total_salary} onChange={v => setField("total_salary", v)} /></div>
          <div><Label>Comissões</Label><CurrencyInput value={form.commissions} onChange={v => setField("commissions", v)} /></div>
          <div><Label>DSR s/ comissões</Label><CurrencyInput value={form.dsr_commissions} onChange={v => setField("dsr_commissions", v)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Encargos Trabalhistas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>INSS empresa 20%</Label><CurrencyInput value={form.inss_employer} onChange={v => setField("inss_employer", v)} /></div>
          <div><Label>INSS terceiros 5,8%</Label><CurrencyInput value={form.inss_third_parties} onChange={v => setField("inss_third_parties", v)} /></div>
          <div><Label>INSS GILRAT 0,5%</Label><CurrencyInput value={form.inss_gilrat} onChange={v => setField("inss_gilrat", v)} /></div>
          <div><Label>FGTS 8%</Label><CurrencyInput value={form.fgts} onChange={v => setField("fgts", v)} /></div>
          <div><Label>Férias 1/12</Label><CurrencyInput value={form.vacation_provision} onChange={v => setField("vacation_provision", v)} /></div>
          <div><Label>1/3 férias</Label><CurrencyInput value={form.vacation_third} onChange={v => setField("vacation_third", v)} /></div>
          <div><Label>13º salário 1/12</Label><CurrencyInput value={form.thirteenth_provision} onChange={v => setField("thirteenth_provision", v)} /></div>
          <div><Label>Total de encargos</Label><CurrencyInput value={form.total_charges} onChange={v => setField("total_charges", v)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Benefícios</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Plano de saúde (Unimed)</Label><CurrencyInput value={form.health_plan} onChange={v => setField("health_plan", v)} /></div>
          <div><Label>Seguro de vida</Label><CurrencyInput value={form.life_insurance} onChange={v => setField("life_insurance", v)} /></div>
          <div><Label>Vale alimentação/refeição</Label><CurrencyInput value={form.meal_voucher} onChange={v => setField("meal_voucher", v)} /></div>
          <div><Label>Vale transporte (mensal)</Label><CurrencyInput value={form.transport_voucher} onChange={v => setField("transport_voucher", v)} /></div>
          <div><Label>Home office</Label><CurrencyInput value={form.home_office_allowance} onChange={v => setField("home_office_allowance", v)} /></div>
          <div><Label>Total de benefícios</Label><CurrencyInput value={form.total_benefits} onChange={v => setField("total_benefits", v)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Custo Total do Colaborador</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Outros custos</Label><CurrencyInput value={form.other_costs} onChange={v => setField("other_costs", v)} /></div>
          <div><Label>Custo total (salário + encargos)</Label><CurrencyInput value={form.total_cost} onChange={v => setField("total_cost", v)} /></div>
          <div><Label>Custo % sobre salário</Label><PercentInput value={form.cost_pct} onChange={v => setField("cost_pct", v)} /></div>
          <div><Label>Custo total mensal</Label><CurrencyInput value={form.monthly_total_cost} onChange={v => setField("monthly_total_cost", v)} /></div>
          <div><Label>Custo anual</Label><CurrencyInput value={form.annual_total_cost} onChange={v => setField("annual_total_cost", v)} /></div>
          <div className="md:col-span-3"><Label>Observação de fonte</Label><Input value={form.source_note || ""} onChange={e => setField("source_note", e.target.value)} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
