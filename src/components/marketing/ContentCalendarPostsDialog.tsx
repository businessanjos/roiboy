import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentPost } from "@/hooks/useContentCalendarData";
import { useNavigate } from "react-router-dom";
import { Instagram, Music2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContentCalendarPostsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: ContentPost[];
  platform: "instagram" | "tiktok";
  date: Date;
}

export function ContentCalendarPostsDialog({
  open,
  onOpenChange,
  posts,
  platform,
  date,
}: ContentCalendarPostsDialogProps) {
  const navigate = useNavigate();

  const handlePostClick = (postId: string) => {
    onOpenChange(false);
    navigate(`/social-media?platform=${platform}&postId=${postId}`);
  };

  const PlatformIcon = platform === "instagram" ? Instagram : Music2;
  const platformName = platform === "instagram" ? "Instagram" : "TikTok";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className="h-5 w-5" />
            Posts do {platformName} - {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => handlePostClick(post.id)}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              {post.thumbnail_url ? (
                <img
                  src={post.thumbnail_url}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <PlatformIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">
                  {post.caption || "Sem legenda"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(post.posted_at), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
