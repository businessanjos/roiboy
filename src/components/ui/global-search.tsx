import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  X,
  ArrowRight,
  Command,
  Users,
  Briefcase,
  CornerDownLeft,
  UserPlus,
  CalendarDays,
  IdCard,
  Loader2,
  CheckSquare,
  Package,
  FileText,
  Truck,
  Wallet,
  FolderKanban,
  UserSearch,
  Building2,
  UserCog,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "./input";
import { Button } from "./button";
import { sectors } from "@/config/sectors";
import { usePermissions } from "@/hooks/usePermissions";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS } from "@/lib/access/permissions";

/** Evento global para abrir a busca a partir de qualquer botão do app. */
export const GLOBAL_SEARCH_EVENT = "roy:open-global-search";
export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_EVENT));
}

/** RH é restrito por allowlist de e-mail (mesma regra de /rh). */
const RH_ALLOWED_EMAILS = [
  "m.quintana@me.com",
  "coachevertonsantos@gmail.com",
  "rh@anjosbusiness.com.br",
  "diessica@consultoria-luma.com",
  "jaqueline@consultoria-luma.com",
  "brualmeida.est@hotmail.com",
  "arthur.mudri@hotmail.com",
];

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  group: string;
  href: string;
  icon?: React.ReactNode;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Remove caracteres que quebram o parser do filtro `or` do PostgREST. */
const sanitize = (value: string) => value.replace(/[,()%*\\]/g, " ").trim();

/** Cache simples em memória — respostas repetidas saem instantâneas. */
const resultCache = new Map<string, SearchResult[]>();


interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { hasSectorAccess, isLoading: sectorLoading } = useSectorAccess();
  const { currentUser } = useCurrentUser();

  const userEmail = (currentUser?.email || "").toLowerCase();
  const canSeeRh = RH_ALLOWED_EMAILS.includes(userEmail);

  // Páginas visíveis: apenas setores liberados + itens cuja permissão o usuário tem.
  const pages = useMemo<SearchResult[]>(() => {
    if (permissionsLoading || sectorLoading) return [];
    const items: SearchResult[] = [];
    for (const sector of sectors) {
      if (sector.comingSoon) continue;
      if (sector.id === "rh" && !canSeeRh) continue;
      if (!hasSectorAccess(sector.id)) continue;
      for (const nav of sector.navItems) {
        if (nav.comingSoon) continue;
        if (nav.permission && !hasPermission(nav.permission)) continue;
        const Icon = nav.icon;
        items.push({
          id: `${sector.id}:${nav.to}`,
          title: nav.label,
          description: nav.group ? `${sector.name} · ${nav.group}` : sector.name,
          group: sector.name,
          href: nav.to,
          icon: <Icon className="h-4 w-4" />,
        });
      }
    }
    // Remove duplicatas de rota mantendo o primeiro setor encontrado.
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [hasPermission, hasSectorAccess, permissionsLoading, sectorLoading, canSeeRh]);

  const canViewClients = hasPermission(PERMISSIONS.CLIENTS_VIEW);
  const canViewSales = hasSectorAccess("vendas");
  const canViewLeads = canViewSales && canViewClients;
  const canViewEvents = hasSectorAccess("eventos") && hasPermission(PERMISSIONS.EVENTS_VIEW);
  const canViewCollaborators = canSeeRh && hasSectorAccess("rh");
  const canViewRh = canViewCollaborators;
  const canViewTasks = true; // tarefas seguem o RLS/setor no próprio banco
  const canViewProducts = hasPermission(PERMISSIONS.PRODUCTS_VIEW);
  const canViewFinancial = hasSectorAccess("financeiro");
  const canViewMarketing = hasSectorAccess("marketing");
  const canViewTeam = hasPermission(PERMISSIONS.TEAM_VIEW);
  // Conversas do ROY zAPP: só os setores que o usuário pode enxergar.
  const zappSectorIds = useMemo(
    () =>
      hasSectorAccess("royzapp")
        ? sectors
            .filter((s) => !s.comingSoon && s.id !== "royzapp" && hasSectorAccess(s.id))
            .map((s) => s.id as string)
        : [],
    [hasSectorAccess],
  );
  const zappSectorKey = zappSectorIds.join("|");
  const canViewContracts = canViewClients;

  const filteredPages = useMemo(() => {
    if (!query.trim()) return pages.slice(0, 8);
    const q = normalize(query.trim());
    return pages
      .filter(
        (item) =>
          normalize(item.title).includes(q) ||
          normalize(item.description || "").includes(q),
      )
      .slice(0, 8);
  }, [pages, query]);

  // Busca de registros (clientes, leads, negócios, eventos, colaboradores).
  // As consultas rodam em paralelo e o RLS do banco garante que só volta
  // aquilo que o usuário pode enxergar.
  useEffect(() => {
    const raw = query.trim();
    const term = sanitize(raw);
    if (term.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }

    const cacheKey = `${term.toLowerCase()}|${canViewClients}${canViewLeads}${canViewSales}${canViewEvents}${canViewCollaborators}${canViewTasks}${canViewProducts}${canViewFinancial}${canViewMarketing}${canViewTeam}${canViewContracts}`;
    const cached = resultCache.get(cacheKey);
    if (cached) {
      setRemote(cached);
      setSearching(false);
      return;
    }

    const reqId = ++requestRef.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      const like = `%${term}%`;
      const digits = term.replace(/\D/g, "");
      const phoneLike = digits.length >= 4 ? `%${digits}%` : null;

      const tasks: PromiseLike<SearchResult[]>[] = [];

      if (canViewClients) {
        const filters = [
          `full_name.ilike.${like}`,
          `company_name.ilike.${like}`,
          `instagram.ilike.${like}`,
        ];
        if (phoneLike) filters.push(`phone_e164.ilike.${phoneLike}`, `cpf.ilike.${phoneLike}`);
        tasks.push(
          supabase
            .from("clients")
            .select("id, full_name, company_name, city, state")
            .or(filters.join(","))
            .limit(6)
            .then(({ data }) =>
              (data || []).map((c) => ({
                id: `client:${c.id}`,
                title: c.full_name,
                description:
                  [c.company_name, [c.city, c.state].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(" · ") || "Cliente",
                group: "Clientes",
                href: `/clients/${c.id}`,
                icon: <Users className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewLeads) {
        const filters = [
          `full_name.ilike.${like}`,
          `company_name.ilike.${like}`,
          `email.ilike.${like}`,
          `instagram.ilike.${like}`,
        ];
        if (phoneLike) filters.push(`phone.ilike.${phoneLike}`, `cpf.ilike.${phoneLike}`);
        tasks.push(
          supabase
            .from("leads")
            .select("id, full_name, company_name, status, city, state")
            .or(filters.join(","))
            .limit(6)
            .then(({ data }) =>
              (data || []).map((l) => ({
                id: `lead:${l.id}`,
                title: l.full_name,
                description:
                  [l.company_name, l.status, [l.city, l.state].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(" · ") || "Lead",
                group: "Leads",
                href: `/leads?lead=${l.id}`,
                icon: <UserPlus className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewSales) {
        const filters = [
          `title.ilike.${like}`,
          `contact_name.ilike.${like}`,
          `contact_email.ilike.${like}`,
        ];
        if (phoneLike) filters.push(`contact_phone.ilike.${phoneLike}`);
        tasks.push(
          supabase
            .from("deals")
            .select("id, title, contact_name, status, value")
            .is("deleted_at", null)
            .or(filters.join(","))
            .limit(6)
            .then(({ data }) =>
              (data || []).map((d) => ({
                id: `deal:${d.id}`,
                title: d.title,
                description: [d.contact_name, d.status].filter(Boolean).join(" · ") || "Negócio",
                group: "Negócios",
                href: `/pipeline?deal=${d.id}`,
                icon: <Briefcase className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewEvents) {
        tasks.push(
          supabase
            .from("events")
            .select("id, title, scheduled_at, status")
            .ilike("title", like)
            .order("scheduled_at", { ascending: false })
            .limit(5)
            .then(({ data }) =>
              (data || []).map((e) => ({
                id: `event:${e.id}`,
                title: e.title,
                description: [
                  e.scheduled_at
                    ? new Date(e.scheduled_at).toLocaleDateString("pt-BR")
                    : null,
                  e.status,
                ]
                  .filter(Boolean)
                  .join(" · "),
                group: "Eventos",
                href: `/events/${e.id}`,
                icon: <CalendarDays className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewCollaborators) {
        tasks.push(
          supabase
            .from("hr_collaborators")
            .select("id, full_name, position, department")
            .or(`full_name.ilike.${like},email.ilike.${like},position.ilike.${like}`)
            .limit(5)
            .then(({ data }) =>
              (data || []).map((c) => ({
                id: `collab:${c.id}`,
                title: c.full_name,
                description:
                  [c.position, c.department].filter(Boolean).join(" · ") || "Colaborador",
                group: "Colaboradores",
                href: `/rh/collaborators/${c.id}`,
                icon: <IdCard className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewTasks) {
        tasks.push(
          supabase
            .from("internal_tasks")
            .select("id, title, description, status, due_date")
            .or(`title.ilike.${like},description.ilike.${like}`)
            .order("due_date", { ascending: false, nullsFirst: false })
            .limit(5)
            .then(({ data }) =>
              (data || []).map((t) => ({
                id: `task:${t.id}`,
                title: t.title,
                description:
                  [
                    t.status,
                    t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Tarefa",
                group: "Tarefas",
                href: `/tasks?task=${t.id}`,
                icon: <CheckSquare className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewProducts) {
        tasks.push(
          supabase
            .from("products")
            .select("id, name, description, price, is_active")
            .or(`name.ilike.${like},description.ilike.${like}`)
            .limit(5)
            .then(({ data }) =>
              (data || []).map((p) => ({
                id: `product:${p.id}`,
                title: p.name,
                description:
                  [
                    p.price
                      ? p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : null,
                    p.is_active ? "Ativo" : "Inativo",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Produto",
                group: "Produtos",
                href: `/products?product=${p.id}`,
                icon: <Package className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewContracts) {
        tasks.push(
          supabase
            .from("client_contracts")
            .select("id, client_id, status, value, start_date, clients!inner(full_name)")
            .ilike("clients.full_name", like)
            .order("start_date", { ascending: false })
            .limit(5)
            .then(({ data }) =>
              (data || []).map((c: Record<string, unknown>) => ({
                id: `contract:${c.id as string}`,
                title: `Contrato · ${(c.clients as { full_name?: string })?.full_name ?? ""}`,
                description:
                  [
                    c.status as string,
                    typeof c.value === "number"
                      ? c.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Contrato",
                group: "Contratos",
                href: `/clients/${c.client_id as string}?tab=contracts`,
                icon: <FileText className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewEvents) {
        tasks.push(
          supabase
            .from("event_suppliers")
            .select("id, name, nome_fantasia, category, city")
            .or(`name.ilike.${like},nome_fantasia.ilike.${like},contact_name.ilike.${like}`)
            .limit(4)
            .then(({ data }) =>
              (data || []).map((s) => ({
                id: `supplier:${s.id}`,
                title: s.name,
                description:
                  [s.nome_fantasia, s.category, s.city].filter(Boolean).join(" · ") ||
                  "Fornecedor",
                group: "Fornecedores",
                href: `/events/suppliers?supplier=${s.id}`,
                icon: <Truck className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewFinancial) {
        tasks.push(
          supabase
            .from("financial_entries")
            .select("id, description, amount, entry_type, due_date, document_number")
            .or(`description.ilike.${like},document_number.ilike.${like}`)
            .order("due_date", { ascending: false })
            .limit(5)
            .then(({ data }) =>
              (data || []).map((e) => ({
                id: `entry:${e.id}`,
                title: e.description,
                description:
                  [
                    e.entry_type === "income" ? "Receita" : "Despesa",
                    typeof e.amount === "number"
                      ? e.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : null,
                    e.due_date ? new Date(e.due_date).toLocaleDateString("pt-BR") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Lançamento",
                group: "Financeiro",
                href: `/financial/entries?entry=${e.id}`,
                icon: <Wallet className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewMarketing) {
        tasks.push(
          supabase
            .from("marketing_projects")
            .select("id, name, description, status")
            .or(`name.ilike.${like},description.ilike.${like}`)
            .limit(4)
            .then(({ data }) =>
              (data || []).map((p) => ({
                id: `mkproject:${p.id}`,
                title: p.name,
                description: [p.status, p.description].filter(Boolean).join(" · ") || "Projeto",
                group: "Projetos",
                href: `/marketing/projetos/${p.id}`,
                icon: <FolderKanban className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewRh) {
        tasks.push(
          supabase
            .from("hr_service_providers")
            .select("id, full_name, company_name, position, provider_kind")
            .or(`full_name.ilike.${like},company_name.ilike.${like},email.ilike.${like}`)
            .limit(4)
            .then(({ data }) =>
              (data || []).map((p) => ({
                id: `provider:${p.id}`,
                title: p.full_name,
                description:
                  [p.company_name, p.position].filter(Boolean).join(" · ") || "Prestador",
                group: "Prestadores",
                href: `/rh/service-providers/${p.id}`,
                icon: <Building2 className="h-4 w-4" />,
              })),
            ),
        );

        tasks.push(
          supabase
            .from("hr_jobs")
            .select("id, title, position, department, status")
            .or(`title.ilike.${like},position.ilike.${like},department.ilike.${like}`)
            .limit(4)
            .then(({ data }) =>
              (data || []).map((j) => ({
                id: `job:${j.id}`,
                title: j.title,
                description:
                  [j.department, j.status].filter(Boolean).join(" · ") || "Vaga",
                group: "Vagas",
                href: `/rh/vacancies/${j.id}`,
                icon: <UserSearch className="h-4 w-4" />,
              })),
            ),
        );
      }

      if (canViewTeam) {
        tasks.push(
          supabase
            .from("users")
            .select("id, name, email, role, is_active")
            .or(`name.ilike.${like},email.ilike.${like}`)
            .eq("is_active", true)
            .limit(4)
            .then(({ data }) =>
              (data || []).map((u) => ({
                id: `user:${u.id}`,
                title: u.name || u.email,
                description: [u.role, u.email].filter(Boolean).join(" · ") || "Equipe",
                group: "Equipe",
                href: `/settings?tab=team&user=${u.id}`,
                icon: <UserCog className="h-4 w-4" />,
              })),
            ),
        );
      }

      const settled = await Promise.all(
        tasks.map((t) => Promise.resolve(t).catch(() => [] as SearchResult[])),
      );
      const results = settled.flat();

      if (requestRef.current !== reqId) return;
      resultCache.set(cacheKey, results);
      if (resultCache.size > 80) {
        resultCache.delete(resultCache.keys().next().value as string);
      }
      setRemote(results);
      setSearching(false);
    }, 160);

    return () => {
      clearTimeout(timer);
    };
  }, [
    query,
    canViewClients,
    canViewLeads,
    canViewSales,
    canViewEvents,
    canViewCollaborators,
    canViewRh,
    canViewTasks,
    canViewProducts,
    canViewFinancial,
    canViewMarketing,
    canViewTeam,
    canViewContracts,
  ]);


  const filteredResults = useMemo(
    () => [...filteredPages, ...remote],
    [filteredPages, remote],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { result: SearchResult; index: number }[]>();
    filteredResults.forEach((result, index) => {
      const list = map.get(result.group) || [];
      list.push({ result, index });
      map.set(result.group, list);
    });
    return Array.from(map.entries());
  }, [filteredResults]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRemote([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.href);
      onOpenChange(false);
    },
    [navigate, onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredResults.length === 0) {
        if (e.key === "Escape") onOpenChange(false);
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredResults.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredResults.length) % filteredResults.length);
          break;
        case "Enter": {
          e.preventDefault();
          const selected = filteredResults[selectedIndex];
          if (selected) handleSelect(selected);
          break;
        }
        case "Escape":
          onOpenChange(false);
          break;
      }
    },
    [filteredResults, selectedIndex, handleSelect, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Busca global</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar em todo o sistema: páginas, clientes, leads, negócios, tarefas..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-4"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={() => setQuery("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searching ? (
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-70" />
              ) : (
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              )}
              <p className="text-sm">
                {searching ? "Buscando..." : "Nenhum resultado encontrado"}
              </p>
            </div>
          ) : (

            <div className="space-y-3">
              {grouped.map(([group, entries]) => (
                <div key={group} className="space-y-1">
                  <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {entries.map(({ result, index }) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                        index === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn("flex-shrink-0", index === selectedIndex && "text-primary")}>
                        {result.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        {result.description && (
                          <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                        )}
                      </div>
                      {index === selectedIndex && (
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">
                <CornerDownLeft className="h-2.5 w-2.5" />
              </kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">esc</kbd>
              fechar
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to trigger global search
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const handleOpen = () => setOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(GLOBAL_SEARCH_EVENT, handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(GLOBAL_SEARCH_EVENT, handleOpen);
    };
  }, []);

  return { open, setOpen };
}

// Search Trigger Button
export function SearchTrigger({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <Button
      variant="outline"
      onClick={onClick || openGlobalSearch}
      className={cn(
        "relative h-10 justify-start text-sm text-muted-foreground sm:pr-12 w-56 lg:w-96",
        className,
      )}
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden lg:inline-flex">Buscar em todo o sistema...</span>
      <span className="inline-flex lg:hidden">Buscar</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </Button>
  );
}
