import { motion } from "framer-motion";
import { CheckCircle, Circle, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  skippedSteps: number[];
  stepLabels: string[];
  stepIcons: React.ElementType[];
  achievements?: Achievement[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  completedSteps,
  skippedSteps,
  stepLabels,
  stepIcons,
  achievements = []
}: OnboardingProgressProps) {
  const progress = ((completedSteps.length) / totalSteps) * 100;
  const unlockedAchievements = achievements.filter(a => a.unlocked);

  return (
    <div className="space-y-4">
      {/* Main progress bar */}
      <div className="relative">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Progresso: {Math.round(progress)}%
          </span>
          <span>
            {completedSteps.length} de {totalSteps} concluídos
          </span>
        </div>
        
        {/* Animated progress bar */}
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary via-primary to-green-500 relative"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex justify-between items-start gap-1">
        {stepIcons.map((Icon, index) => {
          const step = index + 1;
          const isCompleted = completedSteps.includes(step);
          const isSkipped = skippedSteps.includes(step);
          const isCurrent = step === currentStep;

          return (
            <motion.div
              key={step}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <div className="relative">
                <motion.div
                  animate={{
                    scale: isCurrent ? [1, 1.1, 1] : 1,
                    boxShadow: isCurrent 
                      ? ["0 0 0 0 rgba(var(--primary), 0)", "0 0 0 8px rgba(var(--primary), 0.1)", "0 0 0 0 rgba(var(--primary), 0)"]
                      : "none"
                  }}
                  transition={{
                    duration: 2,
                    repeat: isCurrent ? Infinity : 0,
                  }}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                    isCurrent && "border-primary bg-primary text-primary-foreground shadow-lg",
                    isCompleted && !isCurrent && "border-green-500 bg-green-500 text-white",
                    isSkipped && "border-muted bg-muted/50 text-muted-foreground",
                    !isCurrent && !isCompleted && !isSkipped && "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    >
                      <CheckCircle className="h-5 w-5" />
                    </motion.div>
                  ) : isSkipped ? (
                    <Circle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </motion.div>

                {/* Connection line */}
                {index < stepIcons.length - 1 && (
                  <div 
                    className={cn(
                      "absolute top-5 left-full w-full h-0.5 -ml-0.5",
                      isCompleted ? "bg-green-500" : "bg-muted"
                    )}
                    style={{ width: "calc(100% - 20px)" }}
                  />
                )}
              </div>

              <span 
                className={cn(
                  "text-[10px] text-center leading-tight transition-colors",
                  isCurrent && "text-primary font-semibold",
                  isCompleted && !isCurrent && "text-green-600 dark:text-green-400",
                  isSkipped && "text-muted-foreground line-through",
                  !isCurrent && !isCompleted && !isSkipped && "text-muted-foreground"
                )}
              >
                {stepLabels[index]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Achievements section */}
      {unlockedAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 pt-2"
        >
          <Star className="h-4 w-4 text-amber-500" />
          <div className="flex gap-1">
            {unlockedAchievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                className="group relative"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-sm cursor-pointer">
                  <achievement.icon className="h-3.5 w-3.5" />
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <p className="text-xs font-medium">{achievement.title}</p>
                  <p className="text-[10px] text-muted-foreground">{achievement.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Add shimmer animation to global CSS
export const shimmerStyles = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;
