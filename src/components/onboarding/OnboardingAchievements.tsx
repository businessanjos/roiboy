import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy,
  Star,
  Rocket,
  Target,
  Zap,
  Crown,
  Medal,
  Award,
  Sparkles,
  Building2,
  User,
  Package,
  Calendar,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
  step?: number;
  condition?: (data: any, completedSteps: number[]) => boolean;
}

export const ONBOARDING_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_steps",
    title: "Primeiros Passos",
    description: "Iniciou o onboarding",
    icon: Rocket,
    unlocked: false,
    condition: () => true // Always unlocked at start
  },
  {
    id: "company_setup",
    title: "Empresa Configurada",
    description: "Configurou os dados da conta",
    icon: Building2,
    unlocked: false,
    step: 1,
    condition: (data) => !!data.accountName
  },
  {
    id: "ai_enabled",
    title: "IA Ativada",
    description: "Habilitou a inteligência artificial",
    icon: Sparkles,
    unlocked: false,
    step: 2,
    condition: (data) => data.enableAI === true
  },
  {
    id: "first_client",
    title: "Primeiro Cliente",
    description: "Cadastrou seu primeiro cliente",
    icon: User,
    unlocked: false,
    step: 3,
    condition: (data) => !!data.clientName && !!data.clientPhone
  },
  {
    id: "first_product",
    title: "Primeiro Produto",
    description: "Criou seu primeiro produto",
    icon: Package,
    unlocked: false,
    step: 4,
    condition: (data) => !!data.productName
  },
  {
    id: "first_event",
    title: "Primeiro Evento",
    description: "Agendou seu primeiro evento",
    icon: Calendar,
    unlocked: false,
    step: 5,
    condition: (data) => !!data.eventTitle && !!data.eventDate
  },
  {
    id: "team_builder",
    title: "Construtor de Equipe",
    description: "Convidou membros da equipe",
    icon: Users,
    unlocked: false,
    step: 6,
    condition: (data) => !!data.inviteEmails?.trim()
  },
  {
    id: "complete_setup",
    title: "Setup Completo",
    description: "Finalizou todas as etapas",
    icon: Crown,
    unlocked: false,
    condition: (data, completed) => completed.length >= 6
  },
  {
    id: "speed_runner",
    title: "Speed Runner",
    description: "Completou em menos de 3 minutos",
    icon: Zap,
    unlocked: false,
    condition: () => false // Calculated based on time
  }
];

interface AchievementNotificationProps {
  achievement: Achievement;
  onDismiss: () => void;
}

export function AchievementNotification({ 
  achievement, 
  onDismiss 
}: AchievementNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-4 right-4 z-50"
    >
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-sm">
        {/* Icon with glow effect */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-white/30 rounded-full blur-lg animate-pulse" />
          <div className="relative w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <achievement.icon className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium opacity-90">Conquista Desbloqueada!</span>
            </div>
            <p className="font-bold">{achievement.title}</p>
            <p className="text-xs opacity-90">{achievement.description}</p>
          </motion.div>
        </div>

        {/* Sparkles animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: [0, (Math.random() - 0.5) * 100],
                y: [0, (Math.random() - 0.5) * 50]
              }}
              transition={{ 
                duration: 1.5,
                delay: 0.5 + i * 0.1,
                repeat: 1
              }}
              className="absolute top-1/2 left-1/2"
            >
              <Star className="h-3 w-3 text-white/80" />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface AchievementsManagerProps {
  data: any;
  completedSteps: number[];
  currentStep: number;
}

export function useAchievements({ 
  data, 
  completedSteps, 
  currentStep 
}: AchievementsManagerProps) {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set(["first_steps"]));
  const [pendingNotification, setPendingNotification] = useState<Achievement | null>(null);

  useEffect(() => {
    ONBOARDING_ACHIEVEMENTS.forEach(achievement => {
      if (unlockedIds.has(achievement.id)) return;
      
      if (achievement.condition && achievement.condition(data, completedSteps)) {
        setUnlockedIds(prev => new Set([...prev, achievement.id]));
        setPendingNotification(achievement);
      }
    });
  }, [data, completedSteps, currentStep]);

  const achievements: Achievement[] = ONBOARDING_ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: unlockedIds.has(a.id)
  }));

  const dismissNotification = () => setPendingNotification(null);

  return {
    achievements,
    pendingNotification,
    dismissNotification,
    unlockedCount: unlockedIds.size,
    totalCount: ONBOARDING_ACHIEVEMENTS.length
  };
}

interface AchievementsBadgeProps {
  achievements: Achievement[];
  onClick?: () => void;
}

export function AchievementsBadge({ achievements, onClick }: AchievementsBadgeProps) {
  const unlocked = achievements.filter(a => a.unlocked);
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400"
    >
      <Trophy className="h-4 w-4" />
      <span className="text-sm font-medium">{unlocked.length}/{achievements.length}</span>
      
      {/* Mini icons for recent unlocks */}
      <div className="flex -space-x-1">
        {unlocked.slice(-3).map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs"
          >
            <a.icon className="h-3 w-3" />
          </motion.div>
        ))}
      </div>
    </motion.button>
  );
}
