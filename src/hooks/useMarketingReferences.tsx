import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type ReferenceType = "image" | "video" | "link" | "file";

export interface ReferenceBoard {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  color: string;
  position: number;
  created_at: string;
}

export interface MarketingReference {
  id: string;
  account_id: string;
  board_id: string | null;
  title: string | null;
  type: ReferenceType;
  url: string;
  thumbnail_url: string | null;
  storage_path: string | null;
  source_url: string | null;
  notes: string | null;
  tags: string[];
  color_palette: string[];
  width: number | null;
  height: number | null;
  created_at: string;
}

export function useMarketingReferences(boardId?: string | null) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["marketing-reference-boards", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_reference_boards")
        .select("*")
        .eq("account_id", accountId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReferenceBoard[];
    },
    enabled: !!accountId,
  });

  const { data: references = [], isLoading: refsLoading } = useQuery({
    queryKey: ["marketing-references", accountId, boardId],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from("marketing_references")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (boardId) query = query.eq("board_id", boardId);
      const { data, error } = await query;
      if (error) throw error;
      return data as MarketingReference[];
    },
    enabled: !!accountId,
  });

  const createBoard = useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("marketing_reference_boards")
        .insert({
          account_id: accountId,
          name: input.name,
          description: input.description,
          color: input.color || "#a855f7",
          created_by: currentUser?.auth_user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-reference-boards", accountId] });
      toast.success("Board criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_reference_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-reference-boards", accountId] });
      toast.success("Board excluído");
    },
  });

  const uploadFile = async (file: File): Promise<{ url: string; path: string }> => {
    if (!accountId) throw new Error("Sem conta");
    const ext = file.name.split(".").pop();
    const path = `${accountId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("marketing-references").upload(path, file);
    if (error) throw error;
    const { data: signed } = await supabase.storage.from("marketing-references").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: signed?.signedUrl || "", path };
  };

  const createReference = useMutation({
    mutationFn: async (input: Partial<MarketingReference> & { url: string; type: ReferenceType }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("marketing_references")
        .insert({
          account_id: accountId,
          board_id: input.board_id,
          title: input.title,
          type: input.type,
          url: input.url,
          thumbnail_url: input.thumbnail_url,
          storage_path: input.storage_path,
          source_url: input.source_url,
          notes: input.notes,
          tags: input.tags || [],
          created_by: currentUser?.auth_user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-references", accountId] });
      toast.success("Referência adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateReference = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingReference> & { id: string }) => {
      const { error } = await supabase.from("marketing_references").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-references", accountId] }),
  });

  const deleteReference = useMutation({
    mutationFn: async (ref: MarketingReference) => {
      if (ref.storage_path) {
        await supabase.storage.from("marketing-references").remove([ref.storage_path]);
      }
      const { error } = await supabase.from("marketing_references").delete().eq("id", ref.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-references", accountId] });
      toast.success("Referência removida");
    },
  });

  return {
    boards,
    references,
    isLoading: boardsLoading || refsLoading,
    createBoard,
    deleteBoard,
    uploadFile,
    createReference,
    updateReference,
    deleteReference,
  };
}
