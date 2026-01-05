import { 
  Video, 
  FileText, 
  Users, 
  Monitor, 
  Calendar, 
  Clock,
  Megaphone,
  Rocket,
  Handshake,
  Radio,
  Building,
  Presentation,
} from 'lucide-react';

// Unified event types for both operation and marketing
export type EventType = 
  // Operation types
  | "live" 
  | "material" 
  | "mentoria" 
  | "workshop" 
  | "masterclass" 
  | "webinar" 
  | "imersao" 
  | "plantao"
  // Marketing types
  | "launch"
  | "campaign"
  | "content"
  | "partnership"
  | "fair"
  | "other";

export interface EventTypeConfig {
  label: string;
  icon: string;
  defaultColor: string;
  category: 'operation' | 'marketing' | 'both';
}

export const eventTypeConfig: Record<EventType, EventTypeConfig> = {
  // Operation types
  live: { 
    label: 'Live / Encontro', 
    icon: 'video', 
    defaultColor: '#8b5cf6',
    category: 'both'
  },
  material: { 
    label: 'Material', 
    icon: 'file-text', 
    defaultColor: '#64748b',
    category: 'operation'
  },
  mentoria: { 
    label: 'Mentoria', 
    icon: 'users', 
    defaultColor: '#06b6d4',
    category: 'operation'
  },
  workshop: { 
    label: 'Workshop', 
    icon: 'presentation', 
    defaultColor: '#eab308',
    category: 'both'
  },
  masterclass: { 
    label: 'Masterclass', 
    icon: 'video', 
    defaultColor: '#ec4899',
    category: 'operation'
  },
  webinar: { 
    label: 'Webinar', 
    icon: 'monitor', 
    defaultColor: '#8b5cf6',
    category: 'both'
  },
  imersao: { 
    label: 'Imersão', 
    icon: 'calendar', 
    defaultColor: '#f97316',
    category: 'both'
  },
  plantao: { 
    label: 'Plantão de Dúvidas', 
    icon: 'clock', 
    defaultColor: '#10b981',
    category: 'operation'
  },
  // Marketing types
  launch: { 
    label: 'Lançamento', 
    icon: 'rocket', 
    defaultColor: '#ef4444',
    category: 'marketing'
  },
  campaign: { 
    label: 'Campanha', 
    icon: 'megaphone', 
    defaultColor: '#f97316',
    category: 'marketing'
  },
  content: { 
    label: 'Conteúdo', 
    icon: 'file-text', 
    defaultColor: '#06b6d4',
    category: 'marketing'
  },
  partnership: { 
    label: 'Parceria', 
    icon: 'handshake', 
    defaultColor: '#10b981',
    category: 'marketing'
  },
  fair: { 
    label: 'Feira/Congresso', 
    icon: 'building', 
    defaultColor: '#6366f1',
    category: 'marketing'
  },
  other: { 
    label: 'Outro', 
    icon: 'calendar', 
    defaultColor: '#64748b',
    category: 'both'
  },
};

// Icon component mapping
export const eventIconMap: Record<string, React.ElementType> = {
  video: Video,
  'file-text': FileText,
  users: Users,
  monitor: Monitor,
  calendar: Calendar,
  clock: Clock,
  megaphone: Megaphone,
  rocket: Rocket,
  handshake: Handshake,
  radio: Radio,
  building: Building,
  presentation: Presentation,
};

// Get types for specific category
export function getEventTypesForCategory(category: 'operation' | 'marketing' | 'all'): EventType[] {
  if (category === 'all') {
    return Object.keys(eventTypeConfig) as EventType[];
  }
  return (Object.entries(eventTypeConfig) as [EventType, EventTypeConfig][])
    .filter(([_, config]) => config.category === category || config.category === 'both')
    .map(([type]) => type);
}

// Get config with fallback
export function getEventTypeConfig(type: string): EventTypeConfig {
  return eventTypeConfig[type as EventType] || eventTypeConfig.other;
}
