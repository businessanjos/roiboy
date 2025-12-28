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
    <CardContent className="p-3 space-y-2">
        {/* Header with Title and Client */}
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8 border border-primary/20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-xs truncate">{deal.title}</h4>
            <p className="text-[10px] text-muted-foreground truncate">{contactName}</p>
          </div>
        </div>

        {/* Contact Details - Compact */}
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          {contactEmail && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{contactEmail}</span>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{contactPhone}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
            <span>{createdDate}</span>
          </div>
        </div>

        {/* Time Badge and Value - Same Row */}
        <div className="flex items-center justify-between pt-1">
          <Badge 
            variant="secondary" 
            className={cn("text-[10px] px-1.5 py-0", timeBadge.bg, timeBadge.text)}
          >
            {timeBadge.label}
          </Badge>
          <span className="text-xs font-bold text-primary">
            {formatCurrency(deal.value)}
          </span>
        </div>

        {/* Tags - Only if exists */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags.slice(0, 2).map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-[10px] px-1.5 py-0 bg-background"
              >
                {tag}
              </Badge>
            ))}
            {deal.tags.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background">
                +{deal.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
