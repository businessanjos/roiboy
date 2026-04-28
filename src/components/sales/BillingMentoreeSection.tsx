import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Receipt, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export interface BillingMentoreeValues {
  tipo_pessoa: "cpf" | "cnpj" | "";
  doc: string;
  razao_social: string;
  email_nf: string;
  ment_nome: string;
  ment_telefone: string;
  ment_email: string;
}

const FIELD_NAMES = {
  tipo_pessoa: "Tipo de Pessoa (NF)",
  doc: "CPF/CNPJ (NF)",
  razao_social: "Razão Social / Nome (NF)",
  email_nf: "E-mail para envio da NF",
  ment_nome: "Mentorado - Nome",
  ment_telefone: "Mentorado - Telefone",
  ment_email: "Mentorado - E-mail",
} as const;

type Key = keyof BillingMentoreeValues;

export function isBillingMentoreeComplete(v: BillingMentoreeValues): boolean {
  return (
    !!v.tipo_pessoa &&
    !!v.doc.trim() &&
    !!v.razao_social.trim() &&
    !!v.email_nf.trim() &&
    !!v.ment_nome.trim() &&
    !!v.ment_telefone.trim() &&
    !!v.ment_email.trim()
  );
}

interface Props {
  dealId: string;
  accountId: string;
  contactDefaults?: { name?: string | null; phone?: string | null; email?: string | null };
  values: BillingMentoreeValues;
  onChange: (v: BillingMentoreeValues) => void;
}

const formatDoc = (raw: string, type: "cpf" | "cnpj" | "") => {
  const d = raw.replace(/\D/g, "");
  if (type === "cpf") {
    return d.slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  if (type === "cnpj") {
    return d.slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  return raw;
};

export function BillingMentoreeSection({ dealId, accountId, contactDefaults, values, onChange }: Props) {
  const [fieldIds, setFieldIds] = useState<Record<Key, string>>({} as any);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Fetch field IDs + existing values; pre-fill mentorado from contact if empty
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const names = Object.values(FIELD_NAMES);
      const { data: cf } = await supabase
        .from("custom_fields")
        .select("id, name")
        .eq("account_id", accountId)
        .in("name", names);

      const ids = {} as Record<Key, string>;
      (cf || []).forEach((f: any) => {
        const key = (Object.entries(FIELD_NAMES).find(([, n]) => n === f.name)?.[0]) as Key | undefined;
        if (key) ids[key] = f.id;
      });

      const fieldIdList = Object.values(ids);
      let existing: Record<string, any> = {};
      if (fieldIdList.length > 0) {
        const { data: vals } = await supabase
          .from("deal_field_values")
          .select("field_id, value_text")
          .eq("deal_id", dealId)
          .in("field_id", fieldIdList);
        (vals || []).forEach((v: any) => {
          existing[v.field_id] = v.value_text;
        });
      }

      if (cancel) return;

      setFieldIds(ids);

      const next: BillingMentoreeValues = {
        tipo_pessoa: (existing[ids.tipo_pessoa] as any) || "",
        doc: existing[ids.doc] || "",
        razao_social: existing[ids.razao_social] || "",
        email_nf: existing[ids.email_nf] || "",
        ment_nome: existing[ids.ment_nome] || contactDefaults?.name || "",
        ment_telefone: existing[ids.ment_telefone] || contactDefaults?.phone || "",
        ment_email: existing[ids.ment_email] || contactDefaults?.email || "",
      };
      onChange(next);
      setLoading(false);
    })();
    return () => { cancel = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, accountId]);

  const update = (patch: Partial<BillingMentoreeValues>) => {
    onChange({ ...values, ...patch });
  };

  const handleLookup = async () => {
    const cleaned = values.doc.replace(/\D/g, "");
    if (!values.tipo_pessoa) {
      toast.error("Selecione CPF ou CNPJ primeiro");
      return;
    }
    if (values.tipo_pessoa === "cpf" && cleaned.length !== 11) {
      toast.error("CPF deve ter 11 dígitos");
      return;
    }
    if (values.tipo_pessoa === "cnpj" && cleaned.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }

    setSearching(true);
    try {
      if (values.tipo_pessoa === "cnpj") {
        const { data, error } = await supabase.functions.invoke("hubdev-cnpj-lookup", {
          body: { cnpj: cleaned },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
        update({
          razao_social: (data as any).razao_social || (data as any).nome_fantasia || values.razao_social,
          email_nf: values.email_nf || (data as any).email || "",
        });
        toast.success("Dados do CNPJ carregados");
      } else {
        const { data, error } = await supabase.functions.invoke("hubdev-cpf-lookup", {
          body: { cpf: cleaned },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
        update({
          razao_social: (data as any).nome || values.razao_social,
        });
        toast.success("Dados do CPF carregados");
      }
    } catch (err: any) {
      console.error("HubDev lookup error:", err);
      toast.error(err?.message || "Erro ao consultar");
    } finally {
      setSearching(false);
    }
  };

  const ids = useMemo(() => fieldIds, [fieldIds]);

  // Persist to deal_field_values whenever values change (debounced via blur)
  const persist = async (key: Key, value: string) => {
    const fieldId = ids[key];
    if (!fieldId) return;
    await supabase.from("deal_field_values").upsert(
      {
        account_id: accountId,
        deal_id: dealId,
        field_id: fieldId,
        value_text: value || null,
        value_number: null,
        value_boolean: null,
        value_date: null,
        value_json: null,
      },
      { onConflict: "deal_id,field_id" }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando dados...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Faturamento */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-primary" />
          Dados de Faturamento (Nota Fiscal)
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Tipo de Pessoa <span className="text-destructive">*</span></Label>
          <Tabs
            value={values.tipo_pessoa || ""}
            onValueChange={(v) => {
              update({ tipo_pessoa: v as any, doc: "" });
              persist("tipo_pessoa", v);
            }}
          >
            <TabsList className="grid grid-cols-2 w-full max-w-xs">
              <TabsTrigger value="cpf">CPF</TabsTrigger>
              <TabsTrigger value="cnpj">CNPJ</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            {values.tipo_pessoa === "cnpj" ? "CNPJ" : "CPF"} <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              value={formatDoc(values.doc, values.tipo_pessoa)}
              onChange={(e) => update({ doc: e.target.value })}
              onBlur={(e) => persist("doc", e.target.value)}
              placeholder={values.tipo_pessoa === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
              disabled={!values.tipo_pessoa}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleLookup}
              disabled={!values.tipo_pessoa || !values.doc || searching}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Buscar</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Buscamos os dados direto na Receita Federal via HubDev.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            {values.tipo_pessoa === "cnpj" ? "Razão Social" : "Nome Completo"} <span className="text-destructive">*</span>
          </Label>
          <Input
            value={values.razao_social}
            onChange={(e) => update({ razao_social: e.target.value })}
            onBlur={(e) => persist("razao_social", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">E-mail para envio da NF <span className="text-destructive">*</span></Label>
          <Input
            type="email"
            value={values.email_nf}
            onChange={(e) => update({ email_nf: e.target.value })}
            onBlur={(e) => persist("email_nf", e.target.value)}
            placeholder="cliente@exemplo.com"
          />
        </div>
      </div>

      {/* Mentorado */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-primary" />
          Dados do Mentorado
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
          <Input
            value={values.ment_nome}
            onChange={(e) => update({ ment_nome: e.target.value })}
            onBlur={(e) => persist("ment_nome", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
            <Input
              value={values.ment_telefone}
              onChange={(e) => update({ ment_telefone: e.target.value })}
              onBlur={(e) => persist("ment_telefone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">E-mail <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              value={values.ment_email}
              onChange={(e) => update({ ment_email: e.target.value })}
              onBlur={(e) => persist("ment_email", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
