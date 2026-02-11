import { supabase } from "@/integrations/supabase/client";

interface MentionedUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface CreateMentionNotificationsParams {
  mentionedUsers: MentionedUser[];
  currentUser: {
    id: string;
    name: string;
    account_id: string;
  };
  commentContent: string;
  followupId: string;
  clientId: string;
  clientName?: string;
  linkPath: string;
}

/**
 * Creates mention notifications for all mentioned users (excluding the current user).
 * Reusable across Timeline, ClientFollowup, SalesPerformance, ClientFinancial, etc.
 */
export async function createMentionNotifications({
  mentionedUsers,
  currentUser,
  commentContent,
  followupId,
  clientId,
  clientName,
  linkPath,
}: CreateMentionNotificationsParams) {
  if (!currentUser.account_id || mentionedUsers.length === 0) return;

  try {
    const userIdsToNotify = mentionedUsers.map((u) => u.id);

    const contextLabel = clientName ? `Em ${clientName}` : "Em um cliente";
    const snippet = commentContent.slice(0, 100) + (commentContent.length > 100 ? "..." : "");

    const notificationsToCreate = userIdsToNotify.map((userId) => ({
      account_id: currentUser.account_id,
      user_id: userId,
      type: "mention",
      title: `${currentUser.name} mencionou você`,
      content: `${contextLabel}: "${snippet}"`,
      link: linkPath,
      triggered_by_user_id: currentUser.id,
      source_type: "client_followup",
      source_id: followupId,
    }));

    const { error } = await supabase.from("notifications").insert(notificationsToCreate);
    if (error) throw error;
  } catch (error) {
    console.error("Error creating mention notifications:", error);
  }
}
