import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type IdeaStatus = "draft" | "approved" | "in_production" | "scheduled" | "posted" | "archived";
export type IdeaFormat = "reel" | "post" | "story" | "carousel" | "youtube_short" | "youtube_long" | "tiktok" | "live" | "other";
export type IdeaPlatform = "instagram" | "tiktok" | "youtube" | "linkedin" | "multi" | "other";
export type IdeaPriority = "low" | "medium" | "high" | "urgent";
export type AssigneeRole = "designer" | "social_media" | "videomaker" | "copywriter" | "strategist" | "other";

export interface MarketingIdea {
  id: string;
  account_id: string;
  title: string;
  hook: string | null;
  description: string | null;
  format: IdeaFormat;
  platform: IdeaPlatform;
  status: IdeaStatus;
  priority: IdeaPriority;
  planned_date: string | null;
  scheduled_at: string | null;
  scheduled_for: string | null;
  publish_platform: string | null;
  published_at: string | null;
  published_url: string | null;
  posted_at: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  tags: string[];
  trend_id: string | null;
  reference_ids: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Array<{
    id: string;
    user_id: string;
    role: AssigneeRole;
    user?: { name: string; avatar_url: string | null };
  }>;
  checklist?: Array<{
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
  }>;
}

export function useMarketingIdeas() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["marketing-ideas", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_ideas")
        .select(`
          *,
          assignees:marketing_idea_assignees(id, user_id, role),
          checklist:marketing_idea_checklist(id, title, is_completed, position)
        `)
        .eq("account_id", accountId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rawIdeas = ((data as any[]) || []) as MarketingIdea[];
      const assigneeIds = Array.from(
        new Set(
          rawIdeas.flatMap((idea) => idea.assignees?.map((assignee) => assignee.user_id) || [])
        )
      );

      if (assigneeIds.length === 0) {
        return rawIdeas;
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, auth_user_id, name, avatar_url")
        .eq("account_id", accountId)
        .in("auth_user_id", assigneeIds);

      if (usersError) throw usersError;

      const usersByAuthId = new Map(
        ((usersData as any[]) || []).map((user) => [user.auth_user_id, { name: user.name, avatar_url: user.avatar_url }])
      );

      return rawIdeas.map((idea) => ({
        ...idea,
        assignees: idea.assignees?.map((assignee) => ({
          ...assignee,
          user: usersByAuthId.get(assignee.user_id),
        })),
      }));
    },
    enabled: !!accountId,
    retry: 1,
  });

  const createIdea = useMutation({
    mutationFn: async (input: Partial<MarketingIdea>) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("marketing_ideas")
        .insert({
          account_id: accountId,
          title: input.title || "Nova ideia",
          hook: input.hook,
          description: input.description,
          format: input.format || "reel",
          platform: input.platform || "instagram",
          status: input.status || "draft",
          priority: input.priority || "medium",
          planned_date: input.planned_date,
          tags: input.tags || [],
          created_by: currentUser?.auth_user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] });
      toast.success("Ideia criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateIdea = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingIdea> & { id: string }) => {
      const { data, error } = await supabase
        .from("marketing_ideas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] });
      toast.success("Ideia excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAssignees = useMutation({
    mutationFn: async ({ ideaId, assignees }: { ideaId: string; assignees: { user_id: string; role: AssigneeRole }[] }) => {
      await supabase.from("marketing_idea_assignees").delete().eq("idea_id", ideaId);
      if (assignees.length > 0) {
        const { error } = await supabase
          .from("marketing_idea_assignees")
          .insert(assignees.map(a => ({ ...a, idea_id: ideaId })));
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const upsertChecklistItem = useMutation({
    mutationFn: async (item: { id?: string; idea_id: string; title: string; is_completed?: boolean; position?: number }) => {
      if (item.id) {
        const { error } = await supabase.from("marketing_idea_checklist").update({
          title: item.title,
          is_completed: item.is_completed,
          position: item.position,
        }).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_idea_checklist").insert({
          idea_id: item.idea_id,
          title: item.title,
          is_completed: item.is_completed ?? false,
          position: item.position ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteChecklistItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_idea_checklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] }),
  });

  return {
    ideas,
    isLoading,
    createIdea,
    updateIdea,
    deleteIdea,
    setAssignees,
    upsertChecklistItem,
    deleteChecklistItem,
  };
}
