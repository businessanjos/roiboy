import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/hooks/useDeals";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, User } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragging?: boolean;
}

export function DealCard({ deal, onClick, isDragging = false }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const contactName = deal.client?.full_name || deal.contact_name || 'Sem contato';
  const avatarUrl = deal.client?.avatar_url || null;

  const hasClosingDate = !!deal.expected_close_date;
  const closingDate = hasClosingDate ? new Date(deal.expected_close_date!) : null;
  const isOverdue = closingDate && isPast(closingDate) && !isToday(closingDate);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title and Value */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
          <span className="text-sm font-semibold text-primary whitespace-nowrap">
            {formatCurrency(deal.value)}
          </span>
        </div>

        {/* Contact */}
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {contactName}
          </span>
        </div>

        {/* Footer with metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {hasClosingDate && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1",
                  isOverdue && "border-red-500 text-red-500"
                )}
              >
                <Calendar className="h-3 w-3" />
                {format(closingDate!, "dd/MM", { locale: ptBR })}
              </Badge>
            )}
          </div>

          {deal.probability > 0 && (
            <span className="text-xs text-muted-foreground">
              {deal.probability}%
            </span>
          )}
        </div>

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {deal.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{deal.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
