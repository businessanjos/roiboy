import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { activeRestMessages } from "@/lib/tv/restScreen";

export const TV_REST_BUCKET = "tv-rest";

export interface TvRestContent {
  logoUrl: string | null;
  photoUrls: string[];
  messages: string[];
  dayUrl: string | null;
  nightUrl: string | null;
  dayFrom: string | null;
  nightFrom: string | null;
}

/** Converte caminhos do bucket privado em links assinados (24 h). Links http passam direto. */
export async function signTvRestPaths(paths: string[]): Promise<string[]> {
  const toSign = paths.filter((p) => p && !/^https?:\/\//.test(p));
  const signed = new Map<string, string>();
  if (toSign.length) {
    const { data } = await supabase.storage.from(TV_REST_BUCKET).createSignedUrls(toSign, 86_400);
    data?.forEach((d) => { if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl); });
  }
  return paths.map((p) => (/^https?:\/\//.test(p) ? p : signed.get(p) ?? "")).filter(Boolean);
}

export function useTvRestContent(enabled = true) {
  return useQuery({
    queryKey: ["tv-rest-content"],
    enabled,
    queryFn: async (): Promise<TvRestContent> => {
      const { data, error } = await (supabase as any).rpc("tv_rest_content");
      if (error) throw error;
      const photos: string[] = Array.isArray(data?.photos) ? data.photos.filter((p: unknown) => typeof p === "string") : [];
      const urls = await signTvRestPaths([data?.logo_url, ...photos].filter(Boolean));
      const logoUrl = data?.logo_url ? urls[0] ?? null : null;
      const [dayUrl, nightUrl] = await Promise.all([data?.day_image, data?.night_image].map(async (p) => (p ? (await signTvRestPaths([p]))[0] ?? null : null)));
      return { logoUrl, photoUrls: data?.logo_url ? urls.slice(1) : urls, messages: activeRestMessages(data?.messages),
        dayUrl, nightUrl, dayFrom: data?.day_from ?? null, nightFrom: data?.night_from ?? null };
    },
    refetchInterval: 10 * 60_000,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (i) => [10_000, 30_000, 60_000][Math.min(i, 2)],
    staleTime: 5 * 60_000,
  });
}
