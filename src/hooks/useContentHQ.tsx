import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "@/hooks/use-toast";

export type Talent = {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
  niche: string | null;
  brand_voice: string | null;
  active: boolean;
};

export type Pillar = {
  id: string;
  talent_id: string;
  name: string;
  description: string | null;
  color: string | null;
  mix_percentage: number;
  platforms: string[];
  reference_links: any;
};

export type Strategy = {
  id: string;
  talent_id: string;
  year: number;
  quarter: number;
  positioning: string | null;
  audience: string | null;
  tone: string | null;
  goals: any;
  big_bets: any;
};

export type ContentPiece = {
  id: string;
  account_id: string;
  talent_id: string;
  pillar_id: string | null;
  title: string;
  platform: string;
  format: string | null;
  scheduled_date: string | null;
  status: string;
  hook: string | null;
  script: string | null;
  cta: string | null;
  caption: string | null;
  hashtags: string | null;
  thumbnail_brief: string | null;
  briefing: any;
  assigned_user_id: string | null;
  published_url: string | null;
  ai_generated: boolean;
};

export const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "bg-pink-500/15 text-pink-600 border-pink-500/30" },
  { id: "youtube", label: "YouTube", color: "bg-red-500/15 text-red-600 border-red-500/30" },
  { id: "tiktok", label: "TikTok", color: "bg-zinc-800/15 text-zinc-900 dark:text-zinc-100 border-zinc-500/30" },
  { id: "threads", label: "Threads", color: "bg-zinc-700/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30" },
  { id: "linkedin", label: "LinkedIn", color: "bg-blue-600/15 text-blue-700 border-blue-600/30" },
  { id: "pinterest", label: "Pinterest", color: "bg-rose-600/15 text-rose-700 border-rose-600/30" },
  { id: "spotify", label: "Spotify", color: "bg-green-600/15 text-green-700 border-green-600/30" },
];

export const PIECE_STATUSES = [
  { id: "backlog", label: "Backlog", color: "bg-muted text-muted-foreground" },
  { id: "script", label: "Roteiro", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { id: "shooting", label: "Gravação", color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  { id: "editing", label: "Edição", color: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  { id: "approval", label: "Aprovação", color: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  { id: "scheduled", label: "Agendado", color: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30" },
  { id: "published", label: "Publicado", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
];

export function useTalents() {
  return useQuery({
    queryKey: ["content-talents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_talents")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Talent[];
    },
  });
}

export function usePillars(talentId?: string) {
  return useQuery({
    queryKey: ["content-pillars", talentId],
    enabled: !!talentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pillars")
        .select("*")
        .eq("talent_id", talentId!)
        .order("name");
      if (error) throw error;
      return (data || []) as Pillar[];
    },
  });
}

export function useStrategy(talentId?: string, year?: number, quarter?: number) {
  return useQuery({
    queryKey: ["content-strategy", talentId, year, quarter],
    enabled: !!talentId && !!year && !!quarter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_strategies")
        .select("*")
        .eq("talent_id", talentId!)
        .eq("year", year!)
        .eq("quarter", quarter!)
        .maybeSingle();
      if (error) throw error;
      return data as Strategy | null;
    },
  });
}

export function useContentPieces(talentId?: string) {
  return useQuery({
    queryKey: ["content-pieces", talentId],
    enabled: !!talentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
        .select("*")
        .eq("talent_id", talentId!)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ContentPiece[];
    },
  });
}

export function useAllContentPieces() {
  return useQuery({
    queryKey: ["content-pieces", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
        .select("*")
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ContentPiece[];
    },
  });
}

export function useUpsertStrategy() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (s: Partial<Strategy> & { talent_id: string; year: number; quarter: number }) => {
      const payload = { ...s, account_id: currentUser?.account_id };
      const { data, error } = await supabase
        .from("content_strategies")
        .upsert(payload as any, { onConflict: "talent_id,year,quarter" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-strategy"] });
      toast({ title: "Estratégia salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useUpsertPillar() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (p: Partial<Pillar> & { talent_id: string; name: string }) => {
      const payload = { ...p, account_id: currentUser?.account_id };
      const q = p.id
        ? supabase.from("content_pillars").update(payload as any).eq("id", p.id).select().single()
        : supabase.from("content_pillars").insert(payload as any).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pillars"] });
      toast({ title: "Pilar salvo" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeletePillar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_pillars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-pillars"] }),
  });
}

export function useUpsertPiece() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (p: Partial<ContentPiece> & { talent_id: string; title: string; platform: string }) => {
      const payload = { ...p, account_id: currentUser?.account_id };
      const q = p.id
        ? supabase.from("content_pieces").update(payload as any).eq("id", p.id).select().single()
        : supabase.from("content_pieces").insert(payload as any).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces"] });
      toast({ title: "Conteúdo salvo" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeletePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_pieces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces"] });
      toast({ title: "Conteúdo removido" });
    },
  });
}

export async function callContentHQAI(action: string, talent: Talent, payload: any) {
  const { data, error } = await supabase.functions.invoke("content-hq-ai", {
    body: { action, talent, payload },
  });
  if (error) {
    const msg = (error as any).message || "Falha na IA";
    if (msg.includes("429")) toast({ title: "Limite atingido", description: "Tente novamente em instantes.", variant: "destructive" });
    else if (msg.includes("402")) toast({ title: "Sem créditos", description: "Adicione créditos em Settings > Workspace.", variant: "destructive" });
    else toast({ title: "Erro IA", description: msg, variant: "destructive" });
    throw error;
  }
  return data;
}
