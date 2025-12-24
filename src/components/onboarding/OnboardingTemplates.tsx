import { motion } from "framer-motion";
import { 
  Package, 
  Calendar, 
  CheckCircle,
  GraduationCap,
  Users,
  Briefcase,
  Heart,
  Dumbbell,
  Code,
  Palette,
  Music,
  TrendingUp
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Product Templates by Business Type
export interface ProductTemplate {
  id: string;
  name: string;
  description: string;
  price: string;
  icon: React.ElementType;
  category: string;
}

export interface EventTemplate {
  id: string;
  title: string;
  type: string;
  modality: string;
  icon: React.ElementType;
  description: string;
}

export interface BusinessType {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  products: ProductTemplate[];
  events: EventTemplate[];
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "mentoria",
    name: "Mentoria/Coaching",
    icon: GraduationCap,
    color: "purple",
    products: [
      { 
        id: "mentoria-individual", 
        name: "Mentoria Individual", 
        description: "Sessões 1:1 personalizadas", 
        price: "R$ 997,00",
        icon: Users,
        category: "mentoria"
      },
      { 
        id: "mentoria-grupo", 
        name: "Mentoria em Grupo", 
        description: "Acompanhamento em grupo pequeno", 
        price: "R$ 497,00",
        icon: Users,
        category: "mentoria"
      },
      { 
        id: "programa-transformacao", 
        name: "Programa de Transformação", 
        description: "Programa completo de 12 semanas", 
        price: "R$ 2.997,00",
        icon: TrendingUp,
        category: "mentoria"
      }
    ],
    events: [
      { 
        id: "live-boas-vindas", 
        title: "Live de Boas-vindas", 
        type: "live", 
        modality: "online",
        icon: Calendar,
        description: "Apresentação para novos alunos"
      },
      { 
        id: "sessao-qa", 
        title: "Sessão de Perguntas e Respostas", 
        type: "meeting", 
        modality: "online",
        icon: Users,
        description: "Tire dúvidas ao vivo"
      },
      { 
        id: "masterclass", 
        title: "Masterclass Temática", 
        type: "workshop", 
        modality: "online",
        icon: GraduationCap,
        description: "Aula profunda sobre tema específico"
      }
    ]
  },
  {
    id: "consultoria",
    name: "Consultoria/Negócios",
    icon: Briefcase,
    color: "blue",
    products: [
      { 
        id: "consultoria-estrategica", 
        name: "Consultoria Estratégica", 
        description: "Análise e planejamento de negócios", 
        price: "R$ 3.500,00",
        icon: TrendingUp,
        category: "consultoria"
      },
      { 
        id: "diagnostico", 
        name: "Diagnóstico Empresarial", 
        description: "Avaliação completa da empresa", 
        price: "R$ 1.500,00",
        icon: Briefcase,
        category: "consultoria"
      },
      { 
        id: "acompanhamento-mensal", 
        name: "Acompanhamento Mensal", 
        description: "Reuniões e suporte contínuo", 
        price: "R$ 2.000,00",
        icon: Calendar,
        category: "consultoria"
      }
    ],
    events: [
      { 
        id: "reuniao-kickoff", 
        title: "Reunião de Kick-off", 
        type: "meeting", 
        modality: "hybrid",
        icon: Briefcase,
        description: "Início do projeto"
      },
      { 
        id: "workshop-equipe", 
        title: "Workshop com Equipe", 
        type: "workshop", 
        modality: "presential",
        icon: Users,
        description: "Treinamento presencial"
      }
    ]
  },
  {
    id: "saude",
    name: "Saúde/Bem-estar",
    icon: Heart,
    color: "rose",
    products: [
      { 
        id: "plano-nutricional", 
        name: "Plano Nutricional", 
        description: "Acompanhamento alimentar personalizado", 
        price: "R$ 450,00",
        icon: Heart,
        category: "saude"
      },
      { 
        id: "personal-training", 
        name: "Personal Training", 
        description: "Treinos personalizados", 
        price: "R$ 800,00",
        icon: Dumbbell,
        category: "saude"
      },
      { 
        id: "programa-emagrecimento", 
        name: "Programa de Emagrecimento", 
        description: "Plano completo de 90 dias", 
        price: "R$ 1.997,00",
        icon: TrendingUp,
        category: "saude"
      }
    ],
    events: [
      { 
        id: "aulao-funcional", 
        title: "Aulão Funcional", 
        type: "course", 
        modality: "presential",
        icon: Dumbbell,
        description: "Treino em grupo"
      },
      { 
        id: "live-nutricao", 
        title: "Live sobre Nutrição", 
        type: "live", 
        modality: "online",
        icon: Heart,
        description: "Dicas de alimentação saudável"
      }
    ]
  },
  {
    id: "tech",
    name: "Tecnologia/Dev",
    icon: Code,
    color: "emerald",
    products: [
      { 
        id: "curso-programacao", 
        name: "Curso de Programação", 
        description: "Do zero ao profissional", 
        price: "R$ 1.497,00",
        icon: Code,
        category: "tech"
      },
      { 
        id: "mentoria-carreira-tech", 
        name: "Mentoria de Carreira Tech", 
        description: "Acelere sua carreira em tecnologia", 
        price: "R$ 697,00",
        icon: TrendingUp,
        category: "tech"
      }
    ],
    events: [
      { 
        id: "code-review", 
        title: "Code Review ao Vivo", 
        type: "live", 
        modality: "online",
        icon: Code,
        description: "Análise de código em tempo real"
      },
      { 
        id: "hackathon", 
        title: "Hackathon", 
        type: "workshop", 
        modality: "hybrid",
        icon: Code,
        description: "Maratona de programação"
      }
    ]
  },
  {
    id: "criativo",
    name: "Arte/Criativo",
    icon: Palette,
    color: "pink",
    products: [
      { 
        id: "curso-design", 
        name: "Curso de Design", 
        description: "Aprenda design do básico ao avançado", 
        price: "R$ 897,00",
        icon: Palette,
        category: "criativo"
      },
      { 
        id: "aulas-musica", 
        name: "Aulas de Música", 
        description: "Aprenda seu instrumento", 
        price: "R$ 250,00",
        icon: Music,
        category: "criativo"
      }
    ],
    events: [
      { 
        id: "live-criativa", 
        title: "Live Criativa", 
        type: "live", 
        modality: "online",
        icon: Palette,
        description: "Criando arte ao vivo"
      },
      { 
        id: "workshop-arte", 
        title: "Workshop de Arte", 
        type: "workshop", 
        modality: "presential",
        icon: Palette,
        description: "Aula prática presencial"
      }
    ]
  }
];

interface TemplateSelectorProps {
  type: "product" | "event";
  selectedId?: string;
  onSelect: (template: ProductTemplate | EventTemplate) => void;
  className?: string;
}

export function TemplateSelector({ 
  type, 
  selectedId,
  onSelect,
  className 
}: TemplateSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Package className="h-4 w-4" />
        <span>Ou escolha um template pronto:</span>
      </div>

      <div className="grid gap-3">
        {BUSINESS_TYPES.map((business, businessIndex) => {
          const templates = type === "product" ? business.products : business.events;
          const Icon = business.icon;

          return (
            <motion.div
              key={business.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: businessIndex * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn(
                  "h-4 w-4",
                  business.color === "purple" && "text-purple-500",
                  business.color === "blue" && "text-blue-500",
                  business.color === "rose" && "text-rose-500",
                  business.color === "emerald" && "text-emerald-500",
                  business.color === "pink" && "text-pink-500"
                )} />
                <span className="text-xs font-medium">{business.name}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {templates.map((template) => {
                  const isSelected = selectedId === template.id;
                  const TemplateIcon = template.icon;

                  return (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelect(template)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      {isSelected && <CheckCircle className="h-3.5 w-3.5" />}
                      <TemplateIcon className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[150px]">
                        {type === "product" 
                          ? (template as ProductTemplate).name 
                          : (template as EventTemplate).title
                        }
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface QuickTemplateBarProps {
  type: "product" | "event";
  onSelect: (template: ProductTemplate | EventTemplate) => void;
}

export function QuickTemplateBar({ type, onSelect }: QuickTemplateBarProps) {
  // Get top 4 templates across all business types
  const allTemplates = type === "product" 
    ? BUSINESS_TYPES.flatMap(b => b.products).slice(0, 4)
    : BUSINESS_TYPES.flatMap(b => b.events).slice(0, 4);

  return (
    <div className="flex flex-wrap gap-2">
      {allTemplates.map((template, i) => {
        const TemplateIcon = template.icon;
        const label = type === "product" 
          ? (template as ProductTemplate).name 
          : (template as EventTemplate).title;
        
        return (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onSelect(template as ProductTemplate | EventTemplate)}
            >
              <TemplateIcon className="h-3 w-3" />
              {label}
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}
