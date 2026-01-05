import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { eventTypeConfig, eventIconMap, getEventTypeConfig } from '@/config/eventTypes';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketingEventCardProps {
  event: MarketingEvent;
  onClick: () => void;
  compact?: boolean;
}

export function MarketingEventCard({ event, onClick, compact = false }: MarketingEventCardProps) {
  const config = getEventTypeConfig(event.event_type);
  const Icon = eventIconMap[config.icon] || Circle;
  const bgColor = event.color || config.defaultColor;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left px-2 py-1 rounded text-xs font-medium text-white truncate hover:opacity-90 transition-opacity"
        style={{ backgroundColor: bgColor }}
        title={event.title}
      >
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all hover:shadow-md",
        "bg-card hover:bg-accent/50"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className="p-1.5 rounded-md shrink-0"
          style={{ backgroundColor: `${bgColor}20`, color: bgColor }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
      </div>
    </button>
  );
}
