export function instagramPostCode(permalink: string | null | undefined): string | null {
  if (!permalink) return null;
  const match = permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

export function instagramPostMediaUrl(permalink: string | null | undefined): string | null {
  const code = instagramPostCode(permalink);
  return code ? `https://www.instagram.com/p/${code}/media/?size=l` : null;
}
