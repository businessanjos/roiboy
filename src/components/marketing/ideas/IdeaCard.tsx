import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Calendar, Sparkles, Image as ImageIcon, Video, Mic, Layers } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MarketingIdea, IdeaFormat, IdeaPriority } from "@/hooks/useMarketingIdeas";

const FORMAT_ICONS: Record<IdeaFormat, any> = {
  reel: Video,
  post: ImageIcon,
  story: Layers,
  carousel: Layers,
  youtube_short: Video,
  youtube_long: Video,
  tiktok: Video,
  live: Mic,
  other: Sparkles,
};

const FORMAT_LABELS: Record<IdeaFormat, string> = {
  reel: "Reel",
  post: "Post",
  story: "Story",
  carousel: "Carrossel",
  youtube_short: "Short",
  youtube_long: "YouTube",
  tiktok: "TikTok",
  live: "Live",
  other: "Outro",
};

const PRIORITY_COLORS: Record<IdeaPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const PRIORITY_LABELS: Record<IdeaPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

interface Props {
  idea: MarketingIdea;
  onClick: () => void;
}

export function IdeaCard({ idea, onClick }: Props) {
  const FormatIcon = FORMAT_ICONS[idea.format];
  const checklistTotal = idea.checklist?.length || 0;
  const checklistDone = idea.checklist?.filter(c => c.is_completed).length || 0;
  const progress = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer p-3 hover:border-primary/50 hover:shadow-md transition-all bg-card"
    >
      {idea.thumbnail_url && (
        <div className="aspect-video rounded-md overflow-hidden mb-2 bg-muted">
          <img src={idea.thumbnail_url} alt={idea.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
          <FormatIcon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {idea.title}
          </h4>
          {idea.hook && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
              "{idea.hook}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
          {FORMAT_LABELS[idea.format]}
        </Badge>
        <Badge className={`text-[10px] py-0 px-1.5 h-5 border-0 ${PRIORITY_COLORS[idea.priority]}`}>
          {PRIORITY_LABELS[idea.priority]}
        </Badge>
        {idea.tags?.slice(0, 2).map(tag => (
          <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
            #{tag}
          </Badge>
        ))}
      </div>

      {checklistTotal > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {checklistDone}/{checklistTotal}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex -space-x-1.5">
          {idea.assignees?.slice(0, 3).map(a => (
            <Avatar key={a.id} className="h-6 w-6 border-2 border-card">
              {a.user?.avatar_url && <AvatarImage src={a.user.avatar_url} />}
              <AvatarFallback className="text-[9px]">
                {a.user?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
          ))}
          {(idea.assignees?.length || 0) > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-medium">
              +{(idea.assignees?.length || 0) - 3}
            </div>
          )}
        </div>
        {idea.planned_date && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(idea.planned_date), "dd MMM", { locale: ptBR })}
          </div>
        )}
      </div>
    </Card>
  );
}
