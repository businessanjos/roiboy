import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Link2, 
  Play, 
  Users, 
  TrendingUp,
  Trophy,
  Minus
} from 'lucide-react';
import { InstagramPost } from '@/hooks/useSocialMediaData';
import { PostFormatBadge } from './PostFormatBadge';
import { PostObjectiveBadge } from './PostObjectiveBadge';
import { cn } from '@/lib/utils';

interface PostComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postA: InstagramPost | null;
  postB: InstagramPost | null;
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  valueA: number;
  valueB: number;
  suffix?: string;
  higherIsBetter?: boolean;
}

function MetricRow({ icon, label, valueA, valueB, suffix = '', higherIsBetter = true }: MetricRowProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const aWins = higherIsBetter ? valueA > valueB : valueA < valueB;
  const bWins = higherIsBetter ? valueB > valueA : valueB < valueA;
  const isTie = valueA === valueB;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2">
      <div className={cn(
        "text-right font-medium flex items-center justify-end gap-2",
        aWins && !isTie && "text-emerald-600"
      )}>
        {aWins && !isTie && <Trophy className="h-4 w-4" />}
        {formatNumber(valueA)}{suffix}
      </div>
      <div className="flex items-center gap-2 text-muted-foreground min-w-[120px] justify-center">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={cn(
        "text-left font-medium flex items-center gap-2",
        bWins && !isTie && "text-emerald-600"
      )}>
        {formatNumber(valueB)}{suffix}
        {bWins && !isTie && <Trophy className="h-4 w-4" />}
      </div>
    </div>
  );
}

function PostCard({ post, label }: { post: InstagramPost; label: string }) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-semibold">{label}</Badge>
          <span className="text-sm text-muted-foreground">
            {format(new Date(post.posted_at), "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <PostFormatBadge format={post.post_type} />
          {post.ai_objective && (
            <PostObjectiveBadge 
              objective={post.ai_objective} 
              confidence={post.ai_objective_confidence}
            />
          )}
        </div>
        {post.caption && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {post.caption}
          </p>
        )}
        {post.composition && post.composition.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.composition.slice(0, 3).map((item, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            {post.composition.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{post.composition.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PostComparisonDialog({ 
  open, 
  onOpenChange, 
  postA, 
  postB 
}: PostComparisonDialogProps) {
  if (!postA || !postB) return null;

  // Calculate totals for summary
  const engagementA = postA.likes + postA.comments + postA.shares + postA.saves;
  const engagementB = postB.likes + postB.comments + postB.shares + postB.saves;

  // Count wins
  const metrics = [
    { a: postA.reach, b: postB.reach },
    { a: postA.likes, b: postB.likes },
    { a: postA.comments, b: postB.comments },
    { a: postA.shares, b: postB.shares },
    { a: postA.saves, b: postB.saves },
    { a: postA.link_clicks || 0, b: postB.link_clicks || 0 },
    { a: postA.views || 0, b: postB.views || 0 },
    { a: postA.followers_gained || 0, b: postB.followers_gained || 0 },
    { a: postA.engagement_rate || 0, b: postB.engagement_rate || 0 },
  ];

  const winsA = metrics.filter(m => m.a > m.b).length;
  const winsB = metrics.filter(m => m.b > m.a).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Comparação de Posts
            <Badge variant="secondary" className="ml-2">
              {winsA > winsB ? 'Post A vence' : winsB > winsA ? 'Post B vence' : 'Empate'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Post Headers */}
            <div className="grid grid-cols-2 gap-4">
              <PostCard post={postA} label="Post A" />
              <PostCard post={postB} label="Post B" />
            </div>

            <Separator />

            {/* Metrics Comparison */}
            <div className="space-y-1">
              <h4 className="font-semibold text-center mb-4">Comparação de Métricas</h4>
              
              <MetricRow 
                icon={<Eye className="h-4 w-4" />}
                label="Alcance"
                valueA={postA.reach}
                valueB={postB.reach}
              />
              <MetricRow 
                icon={<Heart className="h-4 w-4" />}
                label="Curtidas"
                valueA={postA.likes}
                valueB={postB.likes}
              />
              <MetricRow 
                icon={<MessageCircle className="h-4 w-4" />}
                label="Comentários"
                valueA={postA.comments}
                valueB={postB.comments}
              />
              <MetricRow 
                icon={<Share2 className="h-4 w-4" />}
                label="Compartilhamentos"
                valueA={postA.shares}
                valueB={postB.shares}
              />
              <MetricRow 
                icon={<Bookmark className="h-4 w-4" />}
                label="Salvamentos"
                valueA={postA.saves}
                valueB={postB.saves}
              />
              <MetricRow 
                icon={<Link2 className="h-4 w-4" />}
                label="Cliques no Link"
                valueA={postA.link_clicks || 0}
                valueB={postB.link_clicks || 0}
              />
              <MetricRow 
                icon={<Play className="h-4 w-4" />}
                label="Visualizações"
                valueA={postA.views || 0}
                valueB={postB.views || 0}
              />
              <MetricRow 
                icon={<Users className="h-4 w-4" />}
                label="Seguidores Ganhos"
                valueA={postA.followers_gained || 0}
                valueB={postB.followers_gained || 0}
              />
              
              <Separator className="my-3" />
              
              <MetricRow 
                icon={<TrendingUp className="h-4 w-4" />}
                label="Taxa de Engajamento"
                valueA={postA.engagement_rate || 0}
                valueB={postB.engagement_rate || 0}
                suffix="%"
              />
            </div>

            <Separator />

            {/* Summary */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-center">Resumo</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{winsA}</p>
                  <p className="text-sm text-muted-foreground">Vitórias Post A</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {9 - winsA - winsB}
                  </p>
                  <p className="text-sm text-muted-foreground">Empates</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{winsB}</p>
                  <p className="text-sm text-muted-foreground">Vitórias Post B</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
