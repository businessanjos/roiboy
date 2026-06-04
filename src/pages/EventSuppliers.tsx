import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Globe,
  Instagram,
  MapPin,
  Pencil,
  Trash2,
  Star,
  MessageSquare,
  FileText,
  Truck,
} from "lucide-react";

// ===== Categorias de fornecedores =====
const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "buffet", label: "Buffet & Gastronomia", color: "bg-orange-500/10 text-orange-700 border-orange-300" },
  { value: "decoracao", label: "Decoração", color: "bg-pink-500/10 text-pink-700 border-pink-300" },
  { value: "espaco", label: "Espaço / Venue", color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  { value: "fotografia", label: "Fotografia & Vídeo", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  { value: "audio_visual", label: "Áudio e Iluminação", color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  { value: "entretenimento", label: "Entretenimento", color: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-300" },
  { value: "transporte", label: "Transporte & Logística", color: "bg-teal-500/10 text-teal-700 border-teal-300" },
  { value: "brindes", label: "Brindes & Presentes", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { value: "hospedagem", label: "Hospedagem", color: "bg-indigo-500/10 text-indigo-700 border-indigo-300" },
  { value: "papelaria", label: "Papelaria & Convites", color: "bg-rose-500/10 text-rose-700 border-rose-300" },
  { value: "seguranca", label: "Segurança", color: "bg-slate-500/10 text-slate-700 border-slate-300" },
  { value: "outros", label: "Outros", color: "bg-gray-500/10 text-gray-700 border-gray-300" },
];

const QUOTE_STATUS: { value: string; label: string; className: string }[] = [
  { value: "requested", label: "Solicitado", className: "bg-blue-500/10 text-blue-700 border-blue-300" },
  { value: "received", label: "Recebido", className: "bg-amber-500/10 text-amber-700 border-amber-300" },
  { value: "approved", label: "Aprovado", className: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { value: "rejected", label: "Rejeitado", className: "bg-rose-500/10 text-rose-700 border-rose-300" },
];

function getCategory(value: string) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price_range: string | null;
  rating: number | null;
  status: string;
  notes: string | null;
  tags: string[] | null;
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  payment_terms: string | null;
  bank_info: string | null;
  pix_key: string | null;
  services_offered: string | null;
  contract_url: string | null;
}

interface Quote {
  id: string;
  supplier_id: string;
  title: string;
  description: string | null;
  amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const EMPTY_SUPPLIER: Omit<Supplier, "id"> = {
  name: "",
  category: "outros",
  contact_name: "",
  contact_role: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  price_range: "",
  rating: null,
  status: "active",
  notes: "",
  tags: [],
  cnpj: "",
  cpf: "",
  razao_social: "",
  nome_fantasia: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  payment_terms: "",
  bank_info: "",
  pix_key: "",
  services_offered: "",
  contract_url: "",
};

export default function EventSuppliers() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierDialog, setSupplierDialog] = useState<{ open: boolean; data: Partial<Supplier> | null }>({
    open: false,
    data: null,
  });
  const [quoteDialog, setQuoteDialog] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null,
  });
  const [quotesViewSupplier, setQuotesViewSupplier] = useState<Supplier | null>(null);

  // ===== Queries =====
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["event-suppliers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_suppliers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!accountId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["event-supplier-quotes", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_supplier_quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!accountId,
  });

  const quotesBySupplier = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of quotes) {
      if (!map.has(q.supplier_id)) map.set(q.supplier_id, []);
      map.get(q.supplier_id)!.push(q);
    }
    return map;
  }, [quotes]);

  // ===== Mutations =====
  const upsertSupplier = useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      if (!accountId) throw new Error("Conta não identificada");
      const base = {
        ...payload,
        account_id: accountId,
        rating: payload.rating === null || payload.rating === undefined || (payload.rating as unknown as string) === ""
          ? null
          : Number(payload.rating),
      };
      if (payload.id) {
        const { id, ...rest } = base as Supplier;
        const { error } = await supabase.from("event_suppliers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_suppliers").insert(base as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-suppliers"] });
      toast({ title: "Fornecedor salvo" });
      setSupplierDialog({ open: false, data: null });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-suppliers"] });
      toast({ title: "Fornecedor removido" });
    },
  });

  const createQuote = useMutation({
    mutationFn: async (payload: {
      supplier_id: string;
      title: string;
      description: string;
      amount: number | null;
      notes: string;
      sendWhatsApp: boolean;
      supplierPhone?: string | null;
    }) => {
      if (!accountId) throw new Error("Conta não identificada");
      const { error } = await supabase.from("event_supplier_quotes").insert({
        account_id: accountId,
        supplier_id: payload.supplier_id,
        title: payload.title,
        description: payload.description || null,
        amount: payload.amount,
        notes: payload.notes || null,
        status: "requested",
      } as never);
      if (error) throw error;

      if (payload.sendWhatsApp && payload.supplierPhone) {
        const cleanPhone = payload.supplierPhone.replace(/\D/g, "");
        const msg = encodeURIComponent(
          `Olá! Gostaríamos de solicitar um orçamento para: ${payload.title}\n\n${payload.description || ""}`.trim()
        );
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-supplier-quotes"] });
      toast({ title: "Orçamento solicitado" });
      setQuoteDialog({ open: false, supplier: null });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateQuoteStatus = useMutation({
    mutationFn: async ({ id, status, amount }: { id: string; status: string; amount?: number | null }) => {
      const update: Record<string, unknown> = { status };
      if (status === "received") update.responded_at = new Date().toISOString();
      if (status === "approved" || status === "rejected") update.decided_at = new Date().toISOString();
      if (amount !== undefined) update.amount = amount;
      const { error } = await supabase.from("event_supplier_quotes").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-supplier-quotes"] }),
  });

  // ===== Filtered list =====
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !(s.contact_name || "").toLowerCase().includes(q) &&
          !(s.city || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [suppliers, categoryFilter, search]);

  const totalByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of suppliers) map[s.category] = (map[s.category] || 0) + 1;
    return map;
  }, [suppliers]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-pink-600" />
            <h1 className="text-2xl font-semibold">Fornecedores de Eventos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre fornecedores, solicite orçamentos e organize seus eventos
          </p>
        </div>
        <Button onClick={() => setSupplierDialog({ open: true, data: { ...EMPTY_SUPPLIER } })}>
          <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-semibold">{suppliers.filter((s) => s.status === "active").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Orçamentos abertos</p>
            <p className="text-2xl font-semibold">{quotes.filter((q) => q.status === "requested" || q.status === "received").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Categorias</p>
            <p className="text-2xl font-semibold">{Object.keys(totalByCategory).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, contato ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label} {totalByCategory[c.value] ? `(${totalByCategory[c.value]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Suppliers grid */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {suppliers.length === 0
                ? "Nenhum fornecedor cadastrado ainda."
                : "Nenhum fornecedor corresponde aos filtros."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => {
            const cat = getCategory(s.category);
            const sQuotes = quotesBySupplier.get(s.id) || [];
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{s.name}</CardTitle>
                      <Badge variant="outline" className={`mt-2 ${cat.color}`}>
                        {cat.label}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSupplierDialog({ open: true, data: s })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Remover ${s.name}?`)) deleteSupplier.mutate(s.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {s.contact_name && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Contato:</span> {s.contact_name}
                      {s.contact_role ? ` · ${s.contact_role}` : ""}
                    </p>
                  )}
                  {s.cnpj && (
                    <p className="text-muted-foreground text-xs">
                      <span className="font-medium text-foreground">CNPJ:</span> {s.cnpj}
                    </p>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {s.phone}
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2 text-muted-foreground truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {(s.city || s.state) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {[s.city, s.state].filter(Boolean).join(" / ")}
                    </div>
                  )}
                  {s.price_range && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Faixa de preço:</span> {s.price_range}
                    </div>
                  )}
                  {s.rating ? (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < (s.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 pt-1">
                    {s.phone && (
                      <a
                        href={`https://wa.me/${s.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 hover:text-emerald-700"
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}
                    {s.website && (
                      <a href={s.website} target="_blank" rel="noreferrer" className="text-blue-600" title="Site">
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                    {s.instagram && (
                      <a
                        href={s.instagram.startsWith("http") ? s.instagram : `https://instagram.com/${s.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pink-600"
                        title="Instagram"
                      >
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setQuoteDialog({ open: true, supplier: s })}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" /> Solicitar orçamento
                    </Button>
                    {sQuotes.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setQuotesViewSupplier(s)}>
                        {sQuotes.length} {sQuotes.length === 1 ? "orçamento" : "orçamentos"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Supplier form dialog */}
      <SupplierDialog
        state={supplierDialog}
        onClose={() => setSupplierDialog({ open: false, data: null })}
        onSave={(data) => upsertSupplier.mutate(data)}
        saving={upsertSupplier.isPending}
      />

      {/* Quote request dialog */}
      <QuoteDialog
        state={quoteDialog}
        onClose={() => setQuoteDialog({ open: false, supplier: null })}
        onSubmit={(payload) => createQuote.mutate(payload)}
        saving={createQuote.isPending}
      />

      {/* Quotes list dialog */}
      <Dialog open={!!quotesViewSupplier} onOpenChange={(o) => !o && setQuotesViewSupplier(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Orçamentos — {quotesViewSupplier?.name}</DialogTitle>
            <DialogDescription>Histórico de solicitações</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {quotesViewSupplier &&
              (quotesBySupplier.get(quotesViewSupplier.id) || []).map((q) => {
                const status = QUOTE_STATUS.find((s) => s.value === q.status) || QUOTE_STATUS[0];
                return (
                  <div key={q.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{q.title}</p>
                        {q.description && <p className="text-xs text-muted-foreground mt-1">{q.description}</p>}
                      </div>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {q.amount && (
                        <span className="font-medium">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(q.amount)}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={q.status}
                        onValueChange={(v) => updateQuoteStatus.mutate({ id: q.id, status: v })}
                      >
                        <SelectTrigger className="h-8 text-xs w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUOTE_STATUS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Valor"
                        defaultValue={q.amount ?? ""}
                        className="h-8 text-xs w-[120px]"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== q.amount) updateQuoteStatus.mutate({ id: q.id, status: q.status, amount: v });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Supplier dialog ============
function SupplierDialog({
  state,
  onClose,
  onSave,
  saving,
}: {
  state: { open: boolean; data: Partial<Supplier> | null };
  onClose: () => void;
  onSave: (data: Partial<Supplier>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Supplier>>({});

  // Sync when opening
  useMemo(() => {
    if (state.open) setForm(state.data || {});
  }, [state.open, state.data]);

  const set = (k: keyof Supplier, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Dados cadastrais, fiscais, contato e financeiro</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="identificacao" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            <TabsTrigger value="fiscais">Fiscais</TabsTrigger>
            <TabsTrigger value="contato">Contato</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto pr-1 mt-4 min-h-[320px]">
            <TabsContent value="identificacao" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Nome / Apelido *</Label>
                  <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={form.category || "outros"} onValueChange={(v) => set("category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status || "active"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fiscais" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj || ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label>CPF (se PF)</Label>
                  <Input value={form.cpf || ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Razão Social</Label>
                  <Input value={form.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)} />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia || ""} onChange={(e) => set("nome_fantasia", e.target.value)} />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.inscricao_estadual || ""} onChange={(e) => set("inscricao_estadual", e.target.value)} />
                </div>
                <div>
                  <Label>Inscrição Municipal</Label>
                  <Input value={form.inscricao_municipal || ""} onChange={(e) => set("inscricao_municipal", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Pessoa de contato</Label>
                  <Input value={form.contact_name || ""} onChange={(e) => set("contact_name", e.target.value)} />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input value={form.contact_role || ""} onChange={(e) => set("contact_role", e.target.value)} placeholder="Ex: Comercial" />
                </div>
                <div>
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="55 11 99999-9999" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={form.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input value={form.instagram || ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@usuario" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input value={form.zip_code || ""} onChange={(e) => set("zip_code", e.target.value)} placeholder="00000-000" />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood || ""} onChange={(e) => set("neighborhood", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Endereço (rua, número, complemento)</Label>
                  <Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} maxLength={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financeiro" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Faixa de preço</Label>
                  <Input value={form.price_range || ""} onChange={(e) => set("price_range", e.target.value)} placeholder="Ex: R$ 5k - R$ 12k" />
                </div>
                <div>
                  <Label>Avaliação (1-5)</Label>
                  <Select
                    value={form.rating ? String(form.rating) : "0"}
                    onValueChange={(v) => set("rating", v === "0" ? null : Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sem avaliação</SelectItem>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{"★".repeat(n)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Condições de pagamento</Label>
                  <Input
                    value={form.payment_terms || ""}
                    onChange={(e) => set("payment_terms", e.target.value)}
                    placeholder="Ex: 50% sinal + 50% no evento, boleto 30d, etc."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Dados bancários</Label>
                  <Textarea
                    value={form.bank_info || ""}
                    onChange={(e) => set("bank_info", e.target.value)}
                    rows={2}
                    placeholder="Banco, agência, conta, titular"
                  />
                </div>
                <div>
                  <Label>Chave PIX</Label>
                  <Input value={form.pix_key || ""} onChange={(e) => set("pix_key", e.target.value)} />
                </div>
                <div>
                  <Label>Link do contrato</Label>
                  <Input value={form.contract_url || ""} onChange={(e) => set("contract_url", e.target.value)} placeholder="https://" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Serviços oferecidos</Label>
                  <Textarea
                    value={form.services_offered || ""}
                    onChange={(e) => set("services_offered", e.target.value)}
                    rows={2}
                    placeholder="O que esse fornecedor entrega? Pacotes, especialidades, restrições..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações internas</Label>
                  <Textarea
                    value={form.notes || ""}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    placeholder="Detalhes, histórico, alertas..."
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!form.name || saving}
            onClick={() => onSave(form)}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}

// ============ Quote dialog ============
function QuoteDialog({
  state,
  onClose,
  onSubmit,
  saving,
}: {
  state: { open: boolean; supplier: Supplier | null };
  onClose: () => void;
  onSubmit: (payload: {
    supplier_id: string;
    title: string;
    description: string;
    amount: number | null;
    notes: string;
    sendWhatsApp: boolean;
    supplierPhone?: string | null;
  }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (state.open) {
      setTitle("");
      setDescription("");
      setAmount("");
      setNotes("");
    }
  }, [state.open]);

  const submit = (sendWhatsApp: boolean) => {
    if (!state.supplier) return;
    onSubmit({
      supplier_id: state.supplier.id,
      title,
      description,
      amount: amount === "" ? null : Number(amount),
      notes,
      sendWhatsApp,
      supplierPhone: state.supplier.phone,
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar orçamento</DialogTitle>
          <DialogDescription>
            {state.supplier?.name} {state.supplier?.contact_name ? `· ${state.supplier?.contact_name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Item / Serviço *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Buffet para 80 pessoas" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Detalhes do que precisa ser orçado, data prevista, quantidades..."
            />
          </div>
          <div>
            <Label>Valor estimado (opcional)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Observações internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" disabled={!title || saving} onClick={() => submit(false)}>
            Salvar
          </Button>
          <Button
            disabled={!title || saving || !state.supplier?.phone}
            onClick={() => submit(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Salvar e enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
