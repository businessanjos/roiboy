import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface MarketingPersona {
  id: string;
  account_id: string;
  name: string;
  avatar_emoji: string | null;
  is_default: boolean;
  // Identidade
  profession: string | null;
  education: string | null;
  age_range: string | null;
  gender: string | null;
  location: string | null;
  // Negócio
  business_type: string | null;
  business_size: string | null;
  revenue_range: string | null;
  years_in_business: string | null;
  // Psicográfico
  pains: string[];
  desires: string[];
  objections: string[];
  emotional_triggers: string[];
  // Linguagem
  vocabulary: string[];
  channels: string[];
  references_consumed: string[];
  // Contexto
  daily_routine: string | null;
  biggest_dream: string | null;
  biggest_fear: string | null;
  notes: string | null;
  // Meta
  ai_summary: string | null;
  learned_from_clients_at: string | null;
  clients_analyzed_count: number;
  created_at: string;
  updated_at: string;
}

export type PersonaField = keyof Omit<MarketingPersona, "id" | "account_id" | "created_at" | "updated_at" | "is_default" | "name" | "avatar_emoji" | "ai_summary" | "learned_from_clients_at" | "clients_analyzed_count">;

const ARRAY_FIELDS: PersonaField[] = ["pains", "desires", "objections", "emotional_triggers", "vocabulary", "channels", "references_consumed"];

export function isArrayField(field: PersonaField): boolean {
  return ARRAY_FIELDS.includes(field);
}

export function useMarketingPersona() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: persona, isLoading } = useQuery({
    queryKey: ["marketing-persona", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from("marketing_personas")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data as MarketingPersona | null;
    },
    enabled: !!accountId,
  });

  const upsertPersona = useMutation({
    mutationFn: async (updates: Partial<MarketingPersona>) => {
      if (!accountId) throw new Error("Sem conta");
      // Upsert: se já existe a default, atualiza; senão cria
      if (persona) {
        const { error } = await supabase
          .from("marketing_personas")
          .update({ ...updates })
          .eq("id", persona.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("marketing_personas")
          .insert({
            account_id: accountId,
            name: updates.name || "Persona Principal",
            is_default: true,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-persona", accountId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suggestField = useMutation({
    mutationFn: async (input: PersonaField | { field: PersonaField; instagramProfileId?: string | null }) => {
      if (!accountId) throw new Error("Sem conta");
      const field = typeof input === "string" ? input : input.field;
      const instagramProfileId = typeof input === "string" ? undefined : input.instagramProfileId || undefined;
      const { data, error } = await supabase.functions.invoke("suggest-persona-field", {
        body: { accountId, field, currentPersona: persona, instagramProfileId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        suggestion: string | string[];
        format: "text" | "array";
        clientsAnalyzed: number;
        basedOnRealData: boolean;
        instagramUsername?: string | null;
        basedOnInstagram?: boolean;
        instagramHighlights?: { formats: string[]; themes: string[]; hashtags: string[] };
        abTestId?: string | null;
        variantA?: string | string[];
        variantB?: string | string[];
        hasHighlights?: boolean;
      };
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitAbFeedback = useMutation({
    mutationFn: async (input: {
      abTestId: string;
      action: "choose" | "feedback" | "save";
      variant?: "a" | "b" | "none";
      feedback?: "up" | "down";
      value?: any;
    }) => {
      const { data, error } = await supabase.functions.invoke("persona-ab-feedback", {
        body: input,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  return { persona, isLoading, upsertPersona, suggestField, submitAbFeedback };
}

