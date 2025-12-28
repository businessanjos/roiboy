import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/hooks/useDeals";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Mail, Phone, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
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
  const contactEmail = deal.client?.phone_e164 ? null : deal.contact_email;
  const contactPhone = deal.client?.phone_e164 || deal.contact_phone;
  const avatarUrl = deal.client?.avatar_url || null;

  // Calculate days since creation
  const daysSinceCreation = differenceInDays(new Date(), new Date(deal.created_at));
  const createdDate = format(new Date(deal.created_at), "dd/MM/yyyy", { locale: ptBR });

  // Determine time badge color
  const getTimeBadgeStyle = () => {
    if (daysSinceCreation <= 7) {
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-600', label: `Há ${daysSinceCreation} dias` };
    } else if (daysSinceCreation <= 30) {
      return { bg: 'bg-amber-500/20', text: 'text-amber-600', label: `Há ${daysSinceCreation} dias` };
    } else {
      return { bg: 'bg-red-500/20', text: 'text-red-600', label: `Há ${daysSinceCreation} dias` };
    }
  };

  const timeBadge = getTimeBadgeStyle();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all bg-card border-border/50",
        (isDragging || isSortableDragging) && "opacity-50 shadow-xl rotate-1 scale-105"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with Avatar and Name */}
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{contactName}</h4>
            {deal.title !== contactName && (
              <p className="text-xs text-muted-foreground truncate">{deal.title}</p>
            )}
          </div>
        </div>

        {/* Contact Details */}
        <div className="space-y-1.5">
          {contactEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{contactEmail}</span>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{contactPhone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Cadastro: {createdDate}</span>
          </div>
        </div>

        {/* Time Badge */}
        <Badge 
          variant="secondary" 
          className={cn("text-xs", timeBadge.bg, timeBadge.text)}
        >
          {timeBadge.label}
        </Badge>

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {deal.tags.slice(0, 2).map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs px-2 py-0.5 bg-background"
              >
                {tag}
              </Badge>
            ))}
            {deal.tags.length > 2 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-background">
                +{deal.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Value */}
        <div className="pt-2 border-t border-border/50">
          <span className="text-sm font-bold text-primary">
            {formatCurrency(deal.value)}/mês
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
