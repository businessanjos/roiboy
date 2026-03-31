import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface ContentPost {
  id: string;
  caption: string | null;
  title?: string | null;
  thumbnail_url: string | null;
  posted_at: string;
  profile_id: string;
}

export interface ContentByDate {
  [dateKey: string]: {
    instagram: {
      count: number;
      posts: ContentPost[];
    };
    tiktok: {
      count: number;
      posts: ContentPost[];
    };
    youtube: {
      count: number;
      posts: ContentPost[];
    };
  };
}

export function useContentCalendarData(currentMonth: Date) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = monthStart.toISOString();
  const endDate = monthEnd.toISOString();

  return useQuery({
    queryKey: ["content-calendar", accountId, format(currentMonth, "yyyy-MM")],
    queryFn: async (): Promise<ContentByDate> => {
      if (!accountId) return {};

      const [igResponse, tkResponse, ytResponse] = await Promise.all([
        supabase
          .from("instagram_posts")
          .select(`id, caption, thumbnail_url, posted_at, profile_id, instagram_profiles!inner(account_id)`)
          .gte("posted_at", startDate)
          .lte("posted_at", endDate)
          .eq("instagram_profiles.account_id", accountId)
          .order("posted_at", { ascending: true }),
        supabase
          .from("tiktok_posts")
          .select("id, caption, thumbnail_url, posted_at, profile_id")
          .eq("account_id", accountId)
          .gte("posted_at", startDate)
          .lte("posted_at", endDate)
          .order("posted_at", { ascending: true }),
        supabase
          .from("youtube_videos")
          .select("id, title, caption, thumbnail_url, posted_at, channel_id")
          .eq("account_id", accountId)
          .gte("posted_at", startDate)
          .lte("posted_at", endDate)
          .order("posted_at", { ascending: true }),
      ]);

      const igPosts = igResponse.data || [];
      const tkPosts = tkResponse.data || [];
      const ytPosts = ytResponse.data || [];

      const grouped: ContentByDate = {};

      const ensureDateEntry = (dateKey: string) => {
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            instagram: { count: 0, posts: [] },
            tiktok: { count: 0, posts: [] },
            youtube: { count: 0, posts: [] },
          };
        }
      };

      igPosts.forEach((post) => {
        if (!post.posted_at) return;
        const dateKey = format(new Date(post.posted_at), "yyyy-MM-dd");
        ensureDateEntry(dateKey);
        grouped[dateKey].instagram.count++;
        grouped[dateKey].instagram.posts.push({
          id: post.id, caption: post.caption, thumbnail_url: post.thumbnail_url,
          posted_at: post.posted_at, profile_id: post.profile_id,
        });
      });

      tkPosts.forEach((post) => {
        if (!post.posted_at) return;
        const dateKey = format(new Date(post.posted_at), "yyyy-MM-dd");
        ensureDateEntry(dateKey);
        grouped[dateKey].tiktok.count++;
        grouped[dateKey].tiktok.posts.push({
          id: post.id, caption: post.caption, thumbnail_url: post.thumbnail_url,
          posted_at: post.posted_at, profile_id: post.profile_id,
        });
      });

      ytPosts.forEach((post) => {
        if (!post.posted_at) return;
        const dateKey = format(new Date(post.posted_at), "yyyy-MM-dd");
        ensureDateEntry(dateKey);
        grouped[dateKey].youtube.count++;
        grouped[dateKey].youtube.posts.push({
          id: post.id, caption: post.caption, title: post.title, thumbnail_url: post.thumbnail_url,
          posted_at: post.posted_at, profile_id: post.channel_id,
        });
      });

      return grouped;
    },
    enabled: !!accountId,
  });
}
