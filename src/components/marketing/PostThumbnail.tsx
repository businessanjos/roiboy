import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
}

export function PostThumbnail({ src, alt = '', className, imageClassName }: PostThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => setFailedSrc(null), [src]);

  const failed = !src || failedSrc === src;
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted', className)}>
      {failed ? (
        <ImageOff className="h-5 w-5 text-muted-foreground" aria-label="Miniatura indisponível" />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn('h-full w-full object-cover', imageClassName)}
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  );
}
