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
  Plane,
  Award,
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
  | "movimento"
  | "viagem"
  | "autoridade"
  | "other";

export interface EventTypeConfig {
  label: string;
  icon: string;
  defaultColor: string;
  category: 'operation' | 'marketing' | 'both';
}

export const eventTypeConfig: Record<EventType, EventTypeConfig> = {
  // Operation types - tons de azul/ciano/verde
  live: { 
    label: 'Live / Encontro', 
    icon: 'video', 
    defaultColor: '#3b82f6', // blue-500
    category: 'both'
  },
  material: { 
    label: 'Material', 
    icon: 'file-text', 
    defaultColor: '#64748b', // slate-500
    category: 'operation'
  },
  mentoria: { 
    label: 'Mentoria', 
    icon: 'users', 
    defaultColor: '#0ea5e9', // sky-500
    category: 'operation'
  },
  workshop: { 
    label: 'Workshop', 
    icon: 'presentation', 
    defaultColor: '#14b8a6', // teal-500
    category: 'both'
  },
  masterclass: { 
    label: 'Masterclass', 
    icon: 'video', 
    defaultColor: '#6366f1', // indigo-500
    category: 'operation'
  },
  webinar: { 
    label: 'Webinar', 
    icon: 'monitor', 
    defaultColor: '#8b5cf6', // violet-500
    category: 'both'
  },
  imersao: { 
    label: 'Imersão', 
    icon: 'calendar', 
    defaultColor: '#0d9488', // teal-600
    category: 'both'
  },
  plantao: { 
    label: 'Plantão de Dúvidas', 
    icon: 'clock', 
    defaultColor: '#22c55e', // green-500
    category: 'operation'
  },
  // Marketing types - tons de vermelho/laranja/rosa/roxo
  launch: { 
    label: 'Lançamento', 
    icon: 'rocket', 
    defaultColor: '#ef4444', // red-500
    category: 'marketing'
  },
  campaign: { 
    label: 'Campanha', 
    icon: 'megaphone', 
    defaultColor: '#f97316', // orange-500
    category: 'marketing'
  },
  content: { 
    label: 'Conteúdo', 
    icon: 'file-text', 
    defaultColor: '#eab308', // yellow-500
    category: 'marketing'
  },
  partnership: { 
    label: 'Parceria', 
    icon: 'handshake', 
    defaultColor: '#84cc16', // lime-500
    category: 'marketing'
  },
  fair: { 
    label: 'Feira/Congresso', 
    icon: 'building', 
    defaultColor: '#a855f7', // purple-500
    category: 'marketing'
  },
  movimento: { 
    label: 'Movimento', 
    icon: 'megaphone', 
    defaultColor: '#ec4899', // pink-500
    category: 'marketing'
  },
  viagem: { 
    label: 'Viagem', 
    icon: 'plane', 
    defaultColor: '#06b6d4', // cyan-500
    category: 'marketing'
  },
  autoridade: { 
    label: 'Autoridade', 
    icon: 'award', 
    defaultColor: '#eab308', // yellow-500
    category: 'marketing'
  },
  other: { 
    label: 'Outro', 
    icon: 'calendar', 
    defaultColor: '#71717a', // zinc-500
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
  plane: Plane,
  award: Award,
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
