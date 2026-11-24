import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import type { MediaAttachment } from "./useMarketingTasks";
import { attachmentKey, TASK_FILES_BUCKET } from "@/lib/marketing/taskPresentation";

export async function taskAttachmentUrl(attachment: MediaAttachment): Promise<string> {
  if (attachment.path) {
    const { data, error } = await supabase.storage.from(attachment.bucket || TASK_FILES_BUCKET).createSignedUrl(attachment.path, 1800);
    if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o anexo.");
    return data.signedUrl;
  }
  if (!/^https:\/\//i.test(attachment.url)) throw new Error("O endereço do anexo é inválido.");
  return attachment.url;
}
export function useMarketingTaskAttachment(attachment?: MediaAttachment) {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["marketing-task-attachment", currentUser?.account_id, currentUser?.id, attachment ? attachmentKey(attachment) : null],
    queryFn: () => attachment ? taskAttachmentUrl(attachment) : Promise.resolve(""),
    enabled: !!attachment && !!currentUser,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}